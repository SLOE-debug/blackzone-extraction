import { type ProjectileWeaponDefinition } from '../../../../../core/equipment/equipment';
import {
  BattlefieldDamageEventBuffer,
  BattlefieldDamageKind,
  BattlefieldWeaponSourceId,
} from '../../combat/battlefield-damage-event-buffer';
import { EquipmentId } from '../../catalog/equipment-id';
import {
  BattlefieldBowAction,
  BattlefieldBowActionState,
} from '../model/battlefield-bow-action-state';
import { type BattlefieldArrowCombatTarget } from '../model/battlefield-arrow-query';
import {
  BattlefieldArrowRecallKind,
  BattlefieldArrowState,
} from '../model/battlefield-arrow-state';
import { BattlefieldArrowAttachmentSystem } from './battlefield-arrow-attachment-system';
import {
  BattlefieldArrowAimSystem,
  type MutableBattlefieldArrowAimDirection,
} from './battlefield-arrow-aim-system';
import { BattlefieldArrowCollisionSystem } from './battlefield-arrow-collision-system';
import { BattlefieldArrowFlightSystem } from './battlefield-arrow-flight-system';
import { BattlefieldArrowLaunchSystem } from './battlefield-arrow-launch-system';
import {
  BATTLEFIELD_PERMANENT_ARROW_CAPACITY,
  BattlefieldArrowPopulation,
} from './battlefield-arrow-population';
import { BattlefieldArrowRecallSystem } from './battlefield-arrow-recall-system';
import { BattlefieldArrowTetherSystem } from './battlefield-arrow-tether-system';

/** 归弦猎弓每帧读取的玩家位置和瞄准方向。 */
export interface BattlefieldBowOwnerState {
  readonly entityId: number;
  readonly positionX: number;
  readonly positionY: number;
  readonly positionZ: number;
  readonly projectileOriginX: number;
  readonly projectileOriginY: number;
  readonly projectileOriginZ: number;
  readonly aimX: number;
  readonly aimZ: number;
  readonly alive: boolean;
}

/** 组合动作、箭池、去程、附着、召回和弦网的武器领域门面。 */
export class BattlefieldReturningBowRuntime {
  public readonly arrows: BattlefieldArrowPopulation;
  public readonly action = new BattlefieldBowActionState();
  public readonly damageEvents = new BattlefieldDamageEventBuffer();
  public readonly tethers = new BattlefieldArrowTetherSystem();
  private readonly launchSystem = new BattlefieldArrowLaunchSystem();
  private readonly flightSystem = new BattlefieldArrowFlightSystem();
  private readonly collisionSystem = new BattlefieldArrowCollisionSystem();
  private readonly attachmentSystem = new BattlefieldArrowAttachmentSystem();
  private readonly aimSystem = new BattlefieldArrowAimSystem();
  private readonly recallSystem = new BattlefieldArrowRecallSystem();
  private readonly resolvedAim: MutableBattlefieldArrowAimDirection = { x: 0, y: 0, z: 1 };
  private attackSequenceId = 0;
  private skillSequenceId = 0;
  private launchRequested = false;

  constructor(
    public readonly definition: Readonly<ProjectileWeaponDefinition<EquipmentId.ReturningBow>>,
    private readonly target: BattlefieldArrowCombatTarget,
    ownerEntityId = 0,
  ) {
    this.arrows = new BattlefieldArrowPopulation(ownerEntityId);
    if (definition.projectileCapacity !== BATTLEFIELD_PERMANENT_ARROW_CAPACITY) {
      throw new Error('归弦猎弓定义必须声明六支永久箭。');
    }
  }

  public get readyArrowCount(): number {
    return this.arrows.readyCount;
  }

  public setAttackHeld(held: boolean): void {
    this.action.setAttackHeld(held);
  }

  /** 普攻边沿开始蓄力；无箭时请求最早离手箭自动回程。 */
  public requestPrimaryAttack(): boolean {
    if (this.action.action !== BattlefieldBowAction.Idle) {
      return false;
    }
    const arrowIndex = this.arrows.findReadyArrow();
    if (arrowIndex >= 0) {
      this.arrows.state[arrowIndex] = BattlefieldArrowState.Drawing;
      this.launchRequested = this.action.beginCharging();
      return this.launchRequested;
    }
    const recalled = this.arrows.findOldestRecallableArrow();
    if (recalled < 0) {
      return false;
    }
    this.action.setAction(BattlefieldBowAction.AutoRecalling);
    return this.recallSystem.beginRecall(
      this.arrows,
      recalled,
      BattlefieldArrowRecallKind.Automatic,
      this.nextSkillSequence(),
    );
  }

  /** 同时拔出并召回全部离手箭。 */
  public requestRecallAll(): boolean {
    const sequenceId = this.nextSkillSequence();
    let recalled = 0;
    for (let index = 0; index < BATTLEFIELD_PERMANENT_ARROW_CAPACITY; index++) {
      if (this.arrows.state[index] === BattlefieldArrowState.EmbeddedInMonster) {
        this.damageEvents.append({
          sourceEntityId: this.arrows.ownerEntityId[index] ?? 0,
          sourceWeaponId: BattlefieldWeaponSourceId.ReturningBow,
          attackSequenceId: sequenceId,
          targetPopulationId: this.arrows.attachedPopulationId[index] ?? 0,
          targetEntityId: this.arrows.attachedEntityId[index] ?? 0,
          damage: (this.arrows.damage[index] ?? this.definition.baseDamage)
            * this.definition.extractionDamageScale,
          damageKind: BattlefieldDamageKind.Extraction,
          hitPositionX: this.arrows.positionX[index] ?? 0,
          hitPositionY: this.arrows.positionY[index] ?? 0,
          hitPositionZ: this.arrows.positionZ[index] ?? 0,
        });
      }
      recalled += Number(this.recallSystem.beginRecall(
        this.arrows,
        index,
        BattlefieldArrowRecallKind.Skill,
        sequenceId,
      ));
    }
    if (recalled > 0) {
      this.tethers.deactivate();
      this.action.setAction(BattlefieldBowAction.SkillRecalling);
    }
    return recalled > 0;
  }

  public requestTether(): boolean {
    const activated = this.tethers.activate(
      this.arrows,
      this.definition.tetherDurationSeconds,
      this.nextSkillSequence(),
    );
    if (activated) {
      this.action.setAction(BattlefieldBowAction.TetherCast);
    }
    return activated;
  }

  /** 以固定系统顺序推进一帧；Damage 事件留到统一结算入口消费。 */
  public update(deltaTime: number, owner: Readonly<BattlefieldBowOwnerState>): void {
    if (!owner.alive) {
      this.reset(owner.entityId);
      return;
    }
    const shouldRelease = this.action.update(
      deltaTime,
      this.definition.chargeDurationSeconds,
      this.definition.attackIntervalSeconds,
    );
    if (shouldRelease && this.launchRequested) {
      this.launch(owner);
    }
    this.flightSystem.update(this.arrows, deltaTime, owner.positionY);
    this.collisionSystem.update(
      this.arrows,
      this.target,
      this.damageEvents,
      this.definition.projectileRadius,
    );
    this.attachmentSystem.update(this.arrows, this.target, owner.positionY);
    const returned = this.recallSystem.update(
      this.arrows,
      this.target,
      this.damageEvents,
      owner.projectileOriginX,
      owner.projectileOriginY,
      owner.projectileOriginZ,
      this.definition.automaticRecallMinimumSpeed,
      this.definition.automaticRecallMaximumSpeed,
      this.definition.skillRecallMinimumSpeed,
      this.definition.skillRecallMaximumSpeed,
      this.definition.recallAccelerationDistance,
      this.definition.projectileRadius,
      this.definition.automaticRecallDamageScale,
      this.definition.skillRecallDamageScale,
      deltaTime,
    );
    this.tethers.update(
      this.arrows,
      this.target,
      this.damageEvents,
      this.definition.baseDamage,
      this.definition.tetherDamageScale,
      this.definition.tetherHitCooldownSeconds,
      this.definition.tetherSlowScale,
      this.definition.tetherSlowDurationSeconds,
      owner.positionY,
      deltaTime,
    );
    if (returned > 0 && this.action.action === BattlefieldBowAction.AutoRecalling) {
      this.action.setAction(BattlefieldBowAction.Idle);
      if (this.action.held) {
        this.requestPrimaryAttack();
      }
    } else if (this.action.action === BattlefieldBowAction.SkillRecalling
      && this.arrows.countState(BattlefieldArrowState.Returning) === 0) {
      this.action.setAction(BattlefieldBowAction.Idle);
    } else if (this.action.action === BattlefieldBowAction.TetherCast) {
      this.action.setAction(BattlefieldBowAction.Idle);
    }
  }

  public resolveDamageEvents(): number {
    return this.damageEvents.resolve(this.target);
  }

  public reset(ownerEntityId = 0): void {
    this.arrows.reset(ownerEntityId);
    this.action.reset();
    this.collisionSystem.reset();
    this.tethers.deactivate();
    this.damageEvents.beginFrame();
    this.launchRequested = false;
  }

  private launch(owner: Readonly<BattlefieldBowOwnerState>): void {
    const arrowIndex = this.findDrawingArrow();
    if (arrowIndex < 0) {
      this.action.reset();
      this.launchRequested = false;
      return;
    }
    const chargeRatio = this.action.chargeSeconds / this.definition.chargeDurationSeconds;
    this.aimSystem.writeDirection(
      this.target,
      owner.projectileOriginX,
      owner.projectileOriginY,
      owner.projectileOriginZ,
      owner.aimX,
      owner.aimZ,
      this.definition.maximumRange,
      this.definition.projectileRadius,
      owner.positionY,
      this.resolvedAim,
    );
    this.launchSystem.launch(
      this.arrows,
      arrowIndex,
      this.definition,
      owner.projectileOriginX,
      owner.projectileOriginY,
      owner.projectileOriginZ,
      this.resolvedAim.x,
      this.resolvedAim.y,
      this.resolvedAim.z,
      chargeRatio,
      this.nextAttackSequence(),
    );
    this.launchRequested = false;
    this.action.finishShot();
  }

  private findDrawingArrow(): number {
    for (let index = 0; index < BATTLEFIELD_PERMANENT_ARROW_CAPACITY; index++) {
      if (this.arrows.state[index] === BattlefieldArrowState.Drawing) {
        return index;
      }
    }
    return -1;
  }

  private nextAttackSequence(): number {
    this.attackSequenceId = this.attackSequenceId >= 0xffffffff ? 1 : this.attackSequenceId + 1;
    return this.attackSequenceId;
  }

  private nextSkillSequence(): number {
    this.skillSequenceId = this.skillSequenceId >= 0xffffffff ? 1 : this.skillSequenceId + 1;
    return this.skillSequenceId;
  }
}
