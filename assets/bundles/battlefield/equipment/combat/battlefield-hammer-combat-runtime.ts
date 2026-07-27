import { type MeleeWeaponDefinition } from '../../../../core/equipment/equipment';
import { PlanarKnockbackCombineMode } from '../../../../core/contracts/monster-effects';
import {
  BattlefieldMeleeHitBuffer,
} from '../../combat/melee/battlefield-melee-query';
import { BATTLEFIELD_COMBAT_CONFIG } from '../../model/battlefield-combat-config';
import { type BattlefieldHammerWorldPose } from '../model/battlefield-hammer-world-pose';
import { calculateLaunchVelocity, SLEDGEHAMMER_PROGRESSION } from '../items/sledgehammer/sledgehammer-progression';
import { BattlefieldCombatEventBuffer, BattlefieldWeaponHitKind } from './battlefield-combat-event-buffer';
import { type BattlefieldHammerActionState } from './battlefield-hammer-action-state';
import { type MutableHammerActionEvents } from './battlefield-hammer-action-events';
import { type BattlefieldHammerCombatTarget } from './battlefield-hammer-combat-target';
import { BattlefieldHammerHeadSweepState } from './battlefield-hammer-head-sweep-state';
import {
  BattlefieldHammerSweepDebugState,
  type BattlefieldHammerSweepDebugSource,
} from './battlefield-hammer-sweep-debug-state';
import { getHammerDamageScale, getHammerKnockbackSpeed } from './battlefield-hammer-impact-profile';
import { BattlefieldHammerSpinArcSampler } from './battlefield-hammer-spin-arc-sampler';

const MAXIMUM_MELEE_HITS = 512;
const KNOCKBACK_DURATION_SECONDS = 0.28;
const MAGNETIZED_DURATION_SECONDS = 2;
const SPIN_SWEEP_ASSIST_MARGIN = 0.15;

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
  private readonly spinArcSampler = new BattlefieldHammerSpinArcSampler();
  private readonly sweepDebugState = new BattlefieldHammerSweepDebugState();
  private readonly events = new BattlefieldCombatEventBuffer(
    MAXIMUM_MELEE_HITS * SLEDGEHAMMER_PROGRESSION.spinMaximumSweepSubsteps,
  );
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

  public get sweepDebug(): BattlefieldHammerSweepDebugSource {
    return this.sweepDebugState;
  }

  public beginFrame(): void {
    this.events.beginFrame();
    this.sweepDebugState.beginFrame();
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
    this.spinArcSampler.reset();
    this.sweepDebugState.reset();
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
    this.spinArcSampler.updateCenter(owner.positionX, owner.positionZ);
    if (actionState.sweepActive && this.hammerHeadSweep.ready) {
      this.queueHammerSweepHits(owner, actionState, definition, BattlefieldWeaponHitKind.Swing);
    }
    if (actionEvents.uppercutImpact) {
      this.queueUppercutHits(owner, actionState, definition);
    }
    if (actionEvents.groundSlamImpact) {
      this.queueGroundSlamHits(owner, actionState, definition);
    }
    if (actionState.spinSweepActive && this.hammerHeadSweep.ready) {
      this.queueHammerSweepHits(
        owner,
        actionState,
        definition,
        BattlefieldWeaponHitKind.SpinPulse,
      );
    }
    if (actionEvents.spinFinal && this.hammerHeadSweep.ready) {
      this.queueHammerSweepHits(
        owner,
        actionState,
        definition,
        BattlefieldWeaponHitKind.SpinFinal,
      );
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
      this.sweepDebugState.confirmHit(populationId, entityId);
      if ((this.events.kind[index] as BattlefieldWeaponHitKind)
        === BattlefieldWeaponHitKind.Swing) {
        confirmedSwing = true;
      }
      const kind = this.events.kind[index] as BattlefieldWeaponHitKind;
      this.monsters.damageMonster(populationId, entityId, this.events.damage[index] ?? 0);
      const launchVelocity = this.events.launchVelocity[index] ?? 0;
      if (kind === BattlefieldWeaponHitKind.Uppercut && launchVelocity > 0) {
        this.monsters.applyDirectionalLaunch(populationId, entityId, {
          directionX: this.events.directionX[index] ?? 0,
          directionZ: this.events.directionZ[index] ?? 1,
          horizontalSpeed: SLEDGEHAMMER_PROGRESSION.uppercutHorizontalSpeed,
          verticalSpeed: launchVelocity,
          horizontalDrag: SLEDGEHAMMER_PROGRESSION.uppercutHorizontalDrag,
          gravityScale: 1,
          resistanceScale: this.monsters.getAirborneResistance(populationId),
        });
      } else {
        const knockbackSpeed = this.events.knockbackSpeed[index] ?? 0;
        const spin = kind === BattlefieldWeaponHitKind.SpinPulse
          || kind === BattlefieldWeaponHitKind.SpinFinal;
        this.monsters.applyKnockback(populationId, entityId, {
          directionX: this.events.directionX[index] ?? 0,
          directionZ: this.events.directionZ[index] ?? 1,
          initialSpeed: knockbackSpeed,
          remainingSeconds: this.events.knockbackDuration[index]
            ?? KNOCKBACK_DURATION_SECONDS,
          resistanceScale: this.monsters.getKnockbackResistance(populationId),
          combineMode: spin
            ? SLEDGEHAMMER_PROGRESSION.spinKnockbackCombineMode
            : PlanarKnockbackCombineMode.Replace,
          maximumSpeed: spin
            ? SLEDGEHAMMER_PROGRESSION.spinMaximumKnockbackSpeed
            : Math.max(knockbackSpeed, 0.001),
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

  private queueGroundSlamHits(
    owner: Readonly<BattlefieldHammerOwnerState>,
    actionState: BattlefieldHammerActionState,
    definition: Readonly<MeleeWeaponDefinition>,
  ): void {
    const query = this.query;
    query.originX = this.hammerHeadSweep.currentX;
    query.originZ = this.hammerHeadSweep.currentZ;
    query.directionX = actionState.directionX;
    query.directionZ = actionState.directionZ;
    query.reach = definition.reach * SLEDGEHAMMER_PROGRESSION.groundSlamReachScale;
    query.arcRadians = Math.PI * 2;
    const hitCount = this.monsters.collectMeleeHits(query, this.meleeHits);
    for (let index = 0; index < hitCount; index++) {
      this.writeHitEvent(
        index,
        BattlefieldWeaponHitKind.GroundSlam,
        owner,
        actionState,
        definition,
      );
    }
  }

  /** 用玩家前方权威扇区收集自动上挑目标，不再依赖单条锤头胶囊。 */
  private queueUppercutHits(
    owner: Readonly<BattlefieldHammerOwnerState>,
    actionState: BattlefieldHammerActionState,
    definition: Readonly<MeleeWeaponDefinition>,
  ): void {
    const query = this.query;
    query.originX = owner.positionX;
    query.originZ = owner.positionZ;
    query.directionX = actionState.directionX;
    query.directionZ = actionState.directionZ;
    query.reach = definition.reach * SLEDGEHAMMER_PROGRESSION.uppercutReachScale;
    query.arcRadians = SLEDGEHAMMER_PROGRESSION.uppercutArcRadians;
    const hitCount = this.monsters.collectMeleeHits(query, this.meleeHits);
    for (let index = 0; index < hitCount; index++) {
      this.writeHitEvent(
        index,
        BattlefieldWeaponHitKind.Uppercut,
        owner,
        actionState,
        definition,
      );
    }
  }

  private queueHammerSweepHits(
    owner: Readonly<BattlefieldHammerOwnerState>,
    actionState: BattlefieldHammerActionState,
    definition: Readonly<MeleeWeaponDefinition>,
    kind: BattlefieldWeaponHitKind.Swing
      | BattlefieldWeaponHitKind.Uppercut
      | BattlefieldWeaponHitKind.SpinPulse
      | BattlefieldWeaponHitKind.SpinFinal,
  ): void {
    const spin = kind === BattlefieldWeaponHitKind.SpinPulse
      || kind === BattlefieldWeaponHitKind.SpinFinal;
    const sweep = this.hammerHeadSweep;
    const radius = sweep.radius + (spin ? SPIN_SWEEP_ASSIST_MARGIN : 0);
    if (!spin) {
      this.queueSweepSegment(
        sweep.previousX,
        sweep.previousZ,
        sweep.currentX,
        sweep.currentZ,
        radius,
        kind,
        owner,
        actionState,
        definition,
      );
      return;
    }
    const segmentCount = this.spinArcSampler.writeSegments(
      sweep.previousX,
      sweep.previousZ,
      sweep.currentX,
      sweep.currentZ,
      actionState.spinAngleDelta,
    );
    for (let segment = 0; segment < segmentCount; segment++) {
      this.queueSweepSegment(
        this.spinArcSampler.startX[segment] ?? sweep.previousX,
        this.spinArcSampler.startZ[segment] ?? sweep.previousZ,
        this.spinArcSampler.endX[segment] ?? sweep.currentX,
        this.spinArcSampler.endZ[segment] ?? sweep.currentZ,
        radius,
        kind,
        owner,
        actionState,
        definition,
      );
    }
  }

  /** 查询单段胶囊并立即转存命中事件，供普通直线扫掠与旋风子步共用。 */
  private queueSweepSegment(
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
    radius: number,
    kind: BattlefieldWeaponHitKind.Swing
      | BattlefieldWeaponHitKind.Uppercut
      | BattlefieldWeaponHitKind.SpinPulse
      | BattlefieldWeaponHitKind.SpinFinal,
    owner: Readonly<BattlefieldHammerOwnerState>,
    actionState: BattlefieldHammerActionState,
    definition: Readonly<MeleeWeaponDefinition>,
  ): void {
    const query = this.sweepQuery;
    query.startX = startX;
    query.startZ = startZ;
    query.endX = endX;
    query.endZ = endZ;
    query.radius = radius;
    const hitCount = this.monsters.collectMeleeSweepHits(query, this.meleeHits);
    this.sweepDebugState.record(query, this.meleeHits, hitCount);
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
    let directionX = radialKnockback && radial ? radialX / radialLength : actionState.directionX;
    let directionZ = radialKnockback && radial ? radialZ / radialLength : actionState.directionZ;
    if (kind === BattlefieldWeaponHitKind.Uppercut && radial) {
      const mixedX = actionState.directionX * 0.65 + radialX / radialLength * 0.35;
      const mixedZ = actionState.directionZ * 0.65 + radialZ / radialLength * 0.35;
      const mixedLength = Math.max(Math.hypot(mixedX, mixedZ), 0.0001);
      directionX = mixedX / mixedLength;
      directionZ = mixedZ / mixedLength;
    }
    const event = this.mutableEvent;
    event.kind = kind;
    event.attackSequenceId = actionState.attackSequenceId;
    event.populationId = this.meleeHits.populationIds[hitIndex] ?? 0;
    event.entityId = this.meleeHits.entityIds[hitIndex] ?? 0;
    event.directionX = directionX;
    event.directionZ = directionZ;
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
