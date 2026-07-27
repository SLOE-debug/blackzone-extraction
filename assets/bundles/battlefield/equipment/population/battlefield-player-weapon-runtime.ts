import { type Material, type Node } from 'cc';
import { WeaponAction, type MeleeWeaponDefinition, type WeaponGrip } from '../../../../core/equipment/equipment';
import {
  BattlefieldMeleeHitBuffer,
  type BattlefieldMeleeQuery,
  type BattlefieldMeleeSweepQuery,
} from '../../combat/melee/battlefield-melee-query';
import { BATTLEFIELD_COMBAT_CONFIG } from '../../model/battlefield-combat-config';
import { type BattlefieldEquipmentLibrary } from '../catalog/battlefield-equipment-contracts';
import { getBattlefieldEquipmentPrototype } from '../catalog/battlefield-equipment-catalog';
import { EquipmentId } from '../catalog/equipment-id';
import { BattlefieldCombatEventBuffer, BattlefieldWeaponHitKind } from '../combat/battlefield-combat-event-buffer';
import { type BattlefieldFacingLockEffect } from '../combat/battlefield-facing-lock-effect';
import { BattlefieldHammerActionState, type MutableHammerActionEvents } from '../combat/battlefield-hammer-action-state';
import { BattlefieldHammerHeadSweepState } from '../combat/battlefield-hammer-head-sweep-state';
import { BattlefieldWeaponCommandBuffer, type MutableBattlefieldWeaponCommand } from '../combat/battlefield-weapon-command-buffer';
import { calculateLaunchVelocity, SLEDGEHAMMER_PROGRESSION } from '../items/sledgehammer/sledgehammer-progression';
import { createHeldEquipmentMaterial } from '../rendering/held-equipment-material';
import { HeldEquipmentRenderer } from '../rendering/held-equipment-renderer';

const MAXIMUM_MELEE_HITS = 512;
const KNOCKBACK_DURATION_SECONDS = 0.28;
const MAGNETIZED_DURATION_SECONDS = 2;

/** 大锤运行时读取的玩家世界姿态。 */
export interface BattlefieldWeaponOwnerState {
  readonly positionX: number;
  readonly positionY: number;
  readonly positionZ: number;
  readonly heading: number;
  readonly alive: boolean;
}

/** 手持渲染读取的角色权威武器根姿态。 */
export interface BattlefieldWeaponRigPose {
  readonly rootX: number;
  readonly rootY: number;
  readonly rootZ: number;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
  readonly rotationW: number;
}

/** 大锤运行时依赖的异构怪物战斗门面。 */
export interface BattlefieldHammerCombatTarget {
  collectMeleeHits(query: Readonly<BattlefieldMeleeQuery>, result: BattlefieldMeleeHitBuffer): number;
  collectMeleeSweepHits(
    query: Readonly<BattlefieldMeleeSweepQuery>,
    result: BattlefieldMeleeHitBuffer,
  ): number;
  acceptHitSequence(populationId: number, entityId: number, attackSequenceId: number): boolean;
  damageMonster(populationId: number, entityId: number, amount: number): boolean;
  applyKnockback(
    populationId: number,
    entityId: number,
    effect: Readonly<{
      directionX: number;
      directionZ: number;
      initialSpeed: number;
      remainingSeconds: number;
      resistanceScale: number;
    }>,
  ): boolean;
  applyVerticalLaunch(
    populationId: number,
    entityId: number,
    effect: Readonly<{
      initialVelocity: number;
      gravityScale: number;
      resistanceScale: number;
    }>,
  ): boolean;
  applyMagnetized(
    populationId: number,
    entityId: number,
    skillSequenceId: number,
    durationSeconds: number,
  ): boolean;
  getKnockbackResistance(populationId: number): number;
  getAirborneResistance(populationId: number): number;
}

/** HUD 原地读取的大锤连击与技能状态。 */
export interface BattlefieldHammerStatus {
  readonly hitCount: number;
  readonly requiredHits: number;
  readonly momentumReady: boolean;
  readonly action: WeaponAction;
  readonly actionProgress: number;
}

/** 编排玩家大锤行为、命中查询、事件结算和手持渲染生命周期。 */
export class BattlefieldPlayerWeaponRuntime {
  public readonly commands = new BattlefieldWeaponCommandBuffer();
  private readonly material: Material;
  private readonly definition: Readonly<MeleeWeaponDefinition<EquipmentId.Sledgehammer>>;
  private readonly actionState = new BattlefieldHammerActionState();
  private readonly actionEvents: MutableHammerActionEvents = {
    uppercutImpact: false,
    groundSlamImpact: false,
    spinPulse: false,
    spinFinal: false,
  };
  private readonly command: MutableBattlefieldWeaponCommand = {
    swingRequested: false,
    directionX: 0,
    directionZ: 1,
    startsRight: null,
    uppercutRequested: false,
    groundSlamRequested: false,
    spinRequested: false,
  };
  private readonly meleeHits = new BattlefieldMeleeHitBuffer(MAXIMUM_MELEE_HITS);
  private readonly hammerHeadSweep = new BattlefieldHammerHeadSweepState();
  private readonly query: {
    originX: number;
    originZ: number;
    directionX: number;
    directionZ: number;
    reach: number;
    arcRadians: number;
  } = {
    originX: 0,
    originZ: 0,
    directionX: 0,
    directionZ: 1,
    reach: 1,
    arcRadians: Math.PI,
  };
  private readonly sweepQuery: {
    startX: number;
    startZ: number;
    endX: number;
    endZ: number;
    radius: number;
  } = {
    startX: 0,
    startZ: 0,
    endX: 0,
    endZ: 0,
    radius: 0.1,
  };
  private readonly mutableEvent = {
    kind: BattlefieldWeaponHitKind.Swing,
    attackSequenceId: 1,
    populationId: 0,
    entityId: 0,
    directionX: 0,
    directionZ: 1,
    damage: 1,
    knockbackSpeed: 0,
    knockbackDuration: KNOCKBACK_DURATION_SECONDS,
    launchVelocity: 0,
    magnetizedSkillSequence: 0,
    magnetizedDuration: 0,
  };
  private readonly events = new BattlefieldCombatEventBuffer();
  private readonly renderer: HeldEquipmentRenderer;
  private readonly statusValue: {
    hitCount: number;
    requiredHits: number;
    momentumReady: boolean;
    action: WeaponAction;
    actionProgress: number;
  };
  private disposed = false;

  constructor(
    parent: Node,
    equipmentLibrary: BattlefieldEquipmentLibrary,
    private readonly monsters: BattlefieldHammerCombatTarget,
  ) {
    this.definition = equipmentLibrary.get(EquipmentId.Sledgehammer);
    this.material = createHeldEquipmentMaterial();
    try {
      this.renderer = new HeldEquipmentRenderer(parent, EquipmentId.Sledgehammer, this.material);
    } catch (error: unknown) {
      this.material.destroy();
      throw error;
    }
    this.statusValue = {
      hitCount: 0,
      requiredHits: this.definition.specialRequiredHits,
      momentumReady: false,
      action: WeaponAction.Idle,
      actionProgress: 0,
    };
  }

  public get weaponGrip(): WeaponGrip {
    return getBattlefieldEquipmentPrototype(EquipmentId.Sledgehammer).held.grip;
  }

  public get weaponAction(): WeaponAction {
    return this.actionState.action;
  }

  public get weaponActionProgress(): number {
    return this.actionState.progress;
  }

  public get weaponActionSide(): -1 | 0 | 1 {
    return this.actionState.poseSide;
  }

  public get facingLock(): Readonly<BattlefieldFacingLockEffect> | null {
    return this.actionState.facingLock;
  }

  public get movementSpeedScale(): number {
    return this.actionState.action === WeaponAction.Spin ? 0.36 : 1;
  }

  public get hammerStatus(): Readonly<BattlefieldHammerStatus> {
    this.statusValue.hitCount = this.actionState.hitCount;
    this.statusValue.momentumReady = this.actionState.momentumCharges > 0;
    this.statusValue.action = this.actionState.action;
    this.statusValue.actionProgress = this.actionState.progress;
    return this.statusValue;
  }

  /** 在 PreSimulation 阶段消费输入并推进大锤动作时间轴。 */
  public updateActions(deltaTime: number, owner: Readonly<BattlefieldWeaponOwnerState>): void {
    this.ensureActive();
    this.events.beginFrame();
    this.commands.consume(this.command);
    if (owner.alive) {
      if (this.command.spinRequested) {
        this.actionState.requestSpin(owner.heading, SLEDGEHAMMER_PROGRESSION.spinDurationSeconds);
      } else if (this.command.groundSlamRequested) {
        this.actionState.requestGroundSlam(owner.heading);
      } else if (this.command.uppercutRequested) {
        this.actionState.requestUppercut(owner.heading);
      } else if (this.command.swingRequested) {
        this.actionState.requestSwing(
          this.command.directionX,
          this.command.directionZ,
          this.command.startsRight,
        );
      }
    }
    this.actionState.update(
      Math.max(0, Math.min(deltaTime, 0.05)),
      this.definition,
      SLEDGEHAMMER_PROGRESSION.spinPulseIntervalSeconds,
      this.actionEvents,
    );
  }

  /** 在怪物空间索引更新后，用同帧视觉锤头轨迹生成全部命中事件。 */
  public collectCombatHits(owner: Readonly<BattlefieldWeaponOwnerState>): void {
    this.ensureActive();
    if (!owner.alive) {
      return;
    }
    if (this.actionState.sweepActive && this.hammerHeadSweep.ready) {
      this.queueHammerSweepHits(owner, BattlefieldWeaponHitKind.Swing);
    }
    if (this.actionEvents.uppercutImpact && this.hammerHeadSweep.ready) {
      this.queueHammerSweepHits(owner, BattlefieldWeaponHitKind.Uppercut);
    }
    if (this.actionEvents.groundSlamImpact) {
      this.queueHits(owner, BattlefieldWeaponHitKind.GroundSlam);
    }
    if (this.actionEvents.spinPulse) {
      this.queueHits(owner, BattlefieldWeaponHitKind.SpinPulse);
    }
    if (this.actionEvents.spinFinal) {
      this.queueHits(owner, BattlefieldWeaponHitKind.SpinFinal);
    }
  }

  /** 在 PostSimulation 阶段统一结算 Damage 与通用 Effect。 */
  public resolveCombatEvents(): void {
    this.ensureActive();
    let confirmedSwing = false;
    for (let index = 0; index < this.events.count; index++) {
      const populationId = this.events.populationId[index] ?? 0;
      const entityId = this.events.entityId[index] ?? 0;
      if (!this.monsters.acceptHitSequence(
        populationId,
        entityId,
        this.events.attackSequenceId[index] ?? 0,
      )) {
        continue;
      }
      if ((this.events.kind[index] as BattlefieldWeaponHitKind)
        === BattlefieldWeaponHitKind.Swing) {
        confirmedSwing = true;
      }
      this.monsters.damageMonster(populationId, entityId, this.events.damage[index] ?? 0);
      this.monsters.applyKnockback(populationId, entityId, {
        directionX: this.events.directionX[index] ?? 0,
        directionZ: this.events.directionZ[index] ?? 1,
        initialSpeed: this.events.knockbackSpeed[index] ?? 0,
        remainingSeconds: this.events.knockbackDuration[index] ?? KNOCKBACK_DURATION_SECONDS,
        resistanceScale: this.monsters.getKnockbackResistance(populationId),
      });
      const launchVelocity = this.events.launchVelocity[index] ?? 0;
      if (launchVelocity > 0) {
        this.monsters.applyVerticalLaunch(populationId, entityId, {
          initialVelocity: launchVelocity,
          gravityScale: 1,
          resistanceScale: this.monsters.getAirborneResistance(populationId),
        });
      }
      const magnetizedSequence = this.events.magnetizedSkillSequence[index] ?? 0;
      if (magnetizedSequence > 0) {
        this.monsters.applyMagnetized(
          populationId,
          entityId,
          magnetizedSequence,
          this.events.magnetizedDuration[index] ?? MAGNETIZED_DURATION_SECONDS,
        );
      }
    }
    if (confirmedSwing) {
      this.actionState.recordConfirmedAttack(this.definition);
    }
  }

  /** 在角色动画刷新后同步右手挂点和动作曲线。 */
  public synchronizeHeldPose(
    pose: Readonly<BattlefieldWeaponRigPose>,
  ): void {
    this.ensureActive();
    const worldPose = this.renderer.setRigPose(
      this.actionState.action,
      this.actionState.progress,
      this.actionState.poseSide,
      pose,
    );
    this.hammerHeadSweep.synchronize(worldPose, this.renderer.hammerHeadRadius);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.renderer.dispose();
    this.material.destroy();
  }

  private queueHits(
    owner: Readonly<BattlefieldWeaponOwnerState>,
    kind: BattlefieldWeaponHitKind,
  ): void {
    const definition = this.definition;
    const query = this.query;
    const groundSlam = kind === BattlefieldWeaponHitKind.GroundSlam;
    query.originX = groundSlam ? this.hammerHeadSweep.currentX : owner.positionX;
    query.originZ = groundSlam ? this.hammerHeadSweep.currentZ : owner.positionZ;
    query.directionX = this.actionState.directionX;
    query.directionZ = this.actionState.directionZ;
    query.reach = kind === BattlefieldWeaponHitKind.SpinPulse
      || kind === BattlefieldWeaponHitKind.SpinFinal
      ? definition.reach * 1.12
      : groundSlam
        ? definition.reach * SLEDGEHAMMER_PROGRESSION.groundSlamReachScale
        : definition.reach;
    query.arcRadians = kind === BattlefieldWeaponHitKind.SpinPulse
      || kind === BattlefieldWeaponHitKind.SpinFinal
      ? Math.PI * 2
      : groundSlam
        ? Math.PI * 2
        : definition.hitArcRadians;
    const hitCount = this.monsters.collectMeleeHits(query, this.meleeHits);
    for (let index = 0; index < hitCount; index++) {
      this.writeHitEvent(index, kind, owner);
    }
  }

  /** 用视觉锤头前后位置构造 Swept Capsule，并沿攻击序列持续去重。 */
  private queueHammerSweepHits(
    owner: Readonly<BattlefieldWeaponOwnerState>,
    kind: BattlefieldWeaponHitKind.Swing | BattlefieldWeaponHitKind.Uppercut,
  ): void {
    const sweep = this.hammerHeadSweep;
    const query = this.sweepQuery;
    query.startX = sweep.previousX;
    query.startZ = sweep.previousZ;
    query.endX = sweep.currentX;
    query.endZ = sweep.currentZ;
    query.radius = sweep.radius;
    const hitCount = this.monsters.collectMeleeSweepHits(query, this.meleeHits);
    for (let index = 0; index < hitCount; index++) {
      this.writeHitEvent(index, kind, owner);
    }
  }

  private writeHitEvent(
    hitIndex: number,
    kind: BattlefieldWeaponHitKind,
    owner: Readonly<BattlefieldWeaponOwnerState>,
  ): void {
    const targetX = this.meleeHits.positionX[hitIndex] ?? owner.positionX;
    const targetZ = this.meleeHits.positionZ[hitIndex] ?? owner.positionZ;
    const radialX = targetX - owner.positionX;
    const radialZ = targetZ - owner.positionZ;
    const radialLength = Math.hypot(radialX, radialZ);
    const radial = radialLength > 0.0001;
    const spin = kind === BattlefieldWeaponHitKind.SpinPulse
      || kind === BattlefieldWeaponHitKind.SpinFinal;
    const radialKnockback = spin || kind === BattlefieldWeaponHitKind.GroundSlam;
    const event = this.mutableEvent;
    event.kind = kind;
    event.attackSequenceId = this.actionState.attackSequenceId;
    event.populationId = this.meleeHits.populationIds[hitIndex] ?? 0;
    event.entityId = this.meleeHits.entityIds[hitIndex] ?? 0;
    event.directionX = radialKnockback && radial
      ? radialX / radialLength
      : this.actionState.directionX;
    event.directionZ = radialKnockback && radial
      ? radialZ / radialLength
      : this.actionState.directionZ;
    event.damage = this.definition.baseDamage * getDamageScale(kind);
    event.knockbackSpeed = getKnockbackSpeed(kind, this.definition.knockbackImpulse);
    event.knockbackDuration = KNOCKBACK_DURATION_SECONDS;
    event.launchVelocity = kind === BattlefieldWeaponHitKind.Uppercut
      ? calculateLaunchVelocity(
        BATTLEFIELD_COMBAT_CONFIG.airborneGravity,
        SLEDGEHAMMER_PROGRESSION.uppercutLaunchHeight,
      )
      : 0;
    event.magnetizedSkillSequence = spin ? this.actionState.skillSequenceId : 0;
    event.magnetizedDuration = spin ? MAGNETIZED_DURATION_SECONDS : 0;
    this.events.append(event);
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('玩家武器行为运行时已经释放。');
    }
  }
}

function getDamageScale(kind: BattlefieldWeaponHitKind): number {
  switch (kind) {
    case BattlefieldWeaponHitKind.Swing:
      return 1;
    case BattlefieldWeaponHitKind.Uppercut:
      return 1.25;
    case BattlefieldWeaponHitKind.GroundSlam:
      return SLEDGEHAMMER_PROGRESSION.groundSlamDamageScale;
    case BattlefieldWeaponHitKind.SpinPulse:
      return 0.34;
    case BattlefieldWeaponHitKind.SpinFinal:
      return 0.88;
  }
}

function getKnockbackSpeed(kind: BattlefieldWeaponHitKind, baseImpulse: number): number {
  switch (kind) {
    case BattlefieldWeaponHitKind.Swing:
      return baseImpulse;
    case BattlefieldWeaponHitKind.Uppercut:
      return baseImpulse * 0.35;
    case BattlefieldWeaponHitKind.GroundSlam:
      return baseImpulse * SLEDGEHAMMER_PROGRESSION.groundSlamKnockbackScale;
    case BattlefieldWeaponHitKind.SpinPulse:
      return SLEDGEHAMMER_PROGRESSION.spinKnockbackImpulse * 0.62;
    case BattlefieldWeaponHitKind.SpinFinal:
      return SLEDGEHAMMER_PROGRESSION.spinKnockbackImpulse * 1.28;
  }
}
