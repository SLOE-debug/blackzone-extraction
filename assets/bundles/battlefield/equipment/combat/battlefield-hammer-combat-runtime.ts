import { type MeleeWeaponDefinition } from '../../../../core/equipment/equipment';
import {
  BattlefieldMeleeHitBuffer,
} from '../../combat/melee/battlefield-melee-query';
import { BATTLEFIELD_COMBAT_CONFIG } from '../../model/battlefield-combat-config';
import { type BattlefieldHammerWorldPose } from '../model/battlefield-hammer-world-pose';
import { calculateLaunchVelocity, SLEDGEHAMMER_PROGRESSION } from '../items/sledgehammer/sledgehammer-progression';
import { BattlefieldCombatEventBuffer, BattlefieldWeaponHitKind } from './battlefield-combat-event-buffer';
import { type BattlefieldHammerActionState, type MutableHammerActionEvents } from './battlefield-hammer-action-state';
import { type BattlefieldHammerCombatTarget } from './battlefield-hammer-combat-target';
import { BattlefieldHammerHeadSweepState } from './battlefield-hammer-head-sweep-state';
import { getHammerDamageScale, getHammerKnockbackSpeed } from './battlefield-hammer-impact-profile';

const MAXIMUM_MELEE_HITS = 512;
const KNOCKBACK_DURATION_SECONDS = 0.28;
const MAGNETIZED_DURATION_SECONDS = 2;

/** 大锤战斗层读取的玩家世界姿态。 */
export interface BattlefieldHammerOwnerState {
  readonly positionX: number;
  readonly positionY: number;
  readonly positionZ: number;
  readonly heading: number;
  readonly alive: boolean;
}

/** 独立管理大锤扫掠查询、战斗事件生成与通用效果结算。 */
export class BattlefieldHammerCombatRuntime {
  private readonly meleeHits = new BattlefieldMeleeHitBuffer(MAXIMUM_MELEE_HITS);
  private readonly hammerHeadSweep = new BattlefieldHammerHeadSweepState();
  private readonly events = new BattlefieldCombatEventBuffer();
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

  constructor(private readonly monsters: BattlefieldHammerCombatTarget) {}

  public beginFrame(): void {
    this.events.beginFrame();
  }

  /** 写入与 Renderer 同源的锤头位置，供下一帧连续胶囊扫掠。 */
  public synchronizeHead(
    pose: Readonly<BattlefieldHammerWorldPose>,
    radius: number,
  ): void {
    this.hammerHeadSweep.synchronize(pose, radius);
  }

  public reset(): void {
    this.hammerHeadSweep.reset();
    this.events.beginFrame();
  }

  /** 用动作事件和视觉锤头轨迹生成本帧全部待结算命中。 */
  public collectHits(
    owner: Readonly<BattlefieldHammerOwnerState>,
    actionState: BattlefieldHammerActionState,
    actionEvents: Readonly<MutableHammerActionEvents>,
    definition: Readonly<MeleeWeaponDefinition>,
  ): void {
    if (!owner.alive) {
      return;
    }
    if (actionState.sweepActive && this.hammerHeadSweep.ready) {
      this.queueHammerSweepHits(owner, actionState, definition, BattlefieldWeaponHitKind.Swing);
    }
    if (actionEvents.uppercutImpact && this.hammerHeadSweep.ready) {
      this.queueHammerSweepHits(owner, actionState, definition, BattlefieldWeaponHitKind.Uppercut);
    }
    if (actionEvents.groundSlamImpact) {
      this.queueHits(owner, actionState, definition, BattlefieldWeaponHitKind.GroundSlam);
    }
    if (actionEvents.spinPulse) {
      this.queueHits(owner, actionState, definition, BattlefieldWeaponHitKind.SpinPulse);
    }
    if (actionEvents.spinFinal) {
      this.queueHits(owner, actionState, definition, BattlefieldWeaponHitKind.SpinFinal);
    }
  }

  /** 统一提交 Damage、击退、腾空和磁化效果，并回写确认命中。 */
  public resolveEvents(
    actionState: BattlefieldHammerActionState,
    definition: Readonly<MeleeWeaponDefinition>,
  ): void {
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
      actionState.recordConfirmedAttack(definition);
    }
  }

  private queueHits(
    owner: Readonly<BattlefieldHammerOwnerState>,
    actionState: BattlefieldHammerActionState,
    definition: Readonly<MeleeWeaponDefinition>,
    kind: BattlefieldWeaponHitKind,
  ): void {
    const query = this.query;
    const groundSlam = kind === BattlefieldWeaponHitKind.GroundSlam;
    query.originX = groundSlam ? this.hammerHeadSweep.currentX : owner.positionX;
    query.originZ = groundSlam ? this.hammerHeadSweep.currentZ : owner.positionZ;
    query.directionX = actionState.directionX;
    query.directionZ = actionState.directionZ;
    query.reach = kind === BattlefieldWeaponHitKind.SpinPulse
      || kind === BattlefieldWeaponHitKind.SpinFinal
      ? definition.reach * 1.12
      : groundSlam
        ? definition.reach * SLEDGEHAMMER_PROGRESSION.groundSlamReachScale
        : definition.reach;
    query.arcRadians = kind === BattlefieldWeaponHitKind.SpinPulse
      || kind === BattlefieldWeaponHitKind.SpinFinal
      || groundSlam
      ? Math.PI * 2
      : definition.hitArcRadians;
    const hitCount = this.monsters.collectMeleeHits(query, this.meleeHits);
    for (let index = 0; index < hitCount; index++) {
      this.writeHitEvent(index, kind, owner, actionState, definition);
    }
  }

  private queueHammerSweepHits(
    owner: Readonly<BattlefieldHammerOwnerState>,
    actionState: BattlefieldHammerActionState,
    definition: Readonly<MeleeWeaponDefinition>,
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
      this.writeHitEvent(index, kind, owner, actionState, definition);
    }
  }

  private writeHitEvent(
    hitIndex: number,
    kind: BattlefieldWeaponHitKind,
    owner: Readonly<BattlefieldHammerOwnerState>,
    actionState: BattlefieldHammerActionState,
    definition: Readonly<MeleeWeaponDefinition>,
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
    event.attackSequenceId = actionState.attackSequenceId;
    event.populationId = this.meleeHits.populationIds[hitIndex] ?? 0;
    event.entityId = this.meleeHits.entityIds[hitIndex] ?? 0;
    event.directionX = radialKnockback && radial ? radialX / radialLength : actionState.directionX;
    event.directionZ = radialKnockback && radial ? radialZ / radialLength : actionState.directionZ;
    event.damage = definition.baseDamage * getHammerDamageScale(kind);
    event.knockbackSpeed = getHammerKnockbackSpeed(kind, definition.knockbackImpulse);
    event.knockbackDuration = KNOCKBACK_DURATION_SECONDS;
    event.launchVelocity = kind === BattlefieldWeaponHitKind.Uppercut
      ? calculateLaunchVelocity(
        BATTLEFIELD_COMBAT_CONFIG.airborneGravity,
        SLEDGEHAMMER_PROGRESSION.uppercutLaunchHeight,
      )
      : 0;
    event.magnetizedSkillSequence = spin ? actionState.skillSequenceId : 0;
    event.magnetizedDuration = spin ? MAGNETIZED_DURATION_SECONDS : 0;
    this.events.append(event);
  }
}
