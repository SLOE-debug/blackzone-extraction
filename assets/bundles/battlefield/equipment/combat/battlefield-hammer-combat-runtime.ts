import { type MeleeWeaponDefinition } from '../../../../core/equipment/equipment';
import { PlanarKnockbackCombineMode } from '../../../../core/contracts/monster-effects';
import {
  BattlefieldMeleeHitBuffer,
} from '../../combat/melee/battlefield-melee-query';
import { type BattlefieldHammerWorldPose } from '../model/battlefield-hammer-world-pose';
import { SLEDGEHAMMER_PROGRESSION } from '../items/sledgehammer/sledgehammer-progression';
import { type SledgehammerSpinKnockbackValues } from '../items/sledgehammer/sledgehammer-spin-knockback-tuning';
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
import {
  BattlefieldDamageEventBuffer,
  BattlefieldDamageKind,
  BattlefieldWeaponSourceId,
} from './battlefield-damage-event-buffer';

const MAXIMUM_MELEE_HITS = 512;
const KNOCKBACK_DURATION_SECONDS = 0.28;
const SPIN_SWEEP_ASSIST_MARGIN = 0.15;
const SPIN_KINETIC_DAMAGE_BUDGET_SCALE = 0.9;

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
  private readonly damageEvents = new BattlefieldDamageEventBuffer(
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
    launchHeight: 0,
    kineticSkillSequence: 0,
    kineticDamageBudget: 0,
  };

  constructor(
    private readonly monsters: BattlefieldHammerCombatTarget,
    private readonly spinKnockback: Readonly<SledgehammerSpinKnockbackValues>,
  ) {}

  public get sweepDebug(): BattlefieldHammerSweepDebugSource {
    return this.sweepDebugState;
  }

  public beginFrame(): void {
    this.events.beginFrame();
    this.damageEvents.beginFrame();
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
    this.damageEvents.beginFrame();
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

  /** 统一提交 Damage、击退、腾空和动量载体效果，并回写确认命中。 */
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
      const spin = kind === BattlefieldWeaponHitKind.SpinPulse
        || kind === BattlefieldWeaponHitKind.SpinFinal;
      const spinHitCount = spin
        ? this.monsters.recordSpinHit(
          populationId,
          entityId,
          this.events.kineticSkillSequence[index] ?? 0,
        )
        : 0;
      const damage = kind === BattlefieldWeaponHitKind.SpinPulse
        ? definition.baseDamage * getHammerDamageScale(kind, spinHitCount)
        : this.events.damage[index] ?? 0;
      this.damageEvents.append({
        sourceEntityId: 0,
        sourceWeaponId: BattlefieldWeaponSourceId.Sledgehammer,
        attackSequenceId: this.events.attackSequenceId[index] ?? 0,
        targetPopulationId: populationId,
        targetEntityId: entityId,
        damage,
        damageKind: BattlefieldDamageKind.Physical,
        hitPositionX: 0,
        hitPositionY: 0,
        hitPositionZ: 0,
      });
      const launchHeight = this.events.launchHeight[index] ?? 0;
      if (kind === BattlefieldWeaponHitKind.Uppercut && launchHeight > 0) {
        this.monsters.applyDirectionalLaunch(populationId, entityId, {
          directionX: this.events.directionX[index] ?? 0,
          directionZ: this.events.directionZ[index] ?? 1,
          targetHeight: launchHeight,
          horizontalSpeed: SLEDGEHAMMER_PROGRESSION.uppercutHorizontalSpeed,
          horizontalDrag: SLEDGEHAMMER_PROGRESSION.uppercutHorizontalDrag,
          gravityScale: 1,
          landingDamageBase: definition.baseDamage
            * SLEDGEHAMMER_PROGRESSION.uppercutLandingDamageScale,
        });
      } else {
        const knockbackSpeed = this.events.knockbackSpeed[index] ?? 0;
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
            ? this.spinKnockback.maximumSpeed
            : Math.max(knockbackSpeed, 0.001),
        });
        if (spin && spinHitCount === 1) {
          this.monsters.applyDirectionalLaunch(populationId, entityId, {
            directionX: this.events.directionX[index] ?? 0,
            directionZ: this.events.directionZ[index] ?? 1,
            targetHeight: SLEDGEHAMMER_PROGRESSION.spinLaunchHeight,
            horizontalSpeed: SLEDGEHAMMER_PROGRESSION.spinLaunchHorizontalSpeed,
            horizontalDrag: SLEDGEHAMMER_PROGRESSION.spinLaunchHorizontalDrag,
            gravityScale: 1,
            landingDamageBase: definition.baseDamage
              * SLEDGEHAMMER_PROGRESSION.spinLaunchLandingDamageScale,
          });
        }
      }
      const kineticSequence = this.events.kineticSkillSequence[index] ?? 0;
      if (kineticSequence > 0) {
        this.monsters.applyKineticCarrier(
          populationId,
          entityId,
          kineticSequence,
          definition.baseDamage,
          this.events.kineticDamageBudget[index] ?? 0,
        );
      }
    }
    if (confirmedSwing) {
      actionState.recordConfirmedAttack(definition);
    }
    this.damageEvents.resolve(this.monsters);
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
    if (kind === BattlefieldWeaponHitKind.SpinPulse && radial) {
      const normalizedRadialX = radialX / radialLength;
      const normalizedRadialZ = radialZ / radialLength;
      const mixedX = normalizedRadialX * this.spinKnockback.pulseRadialWeight
        - normalizedRadialZ * this.spinKnockback.pulseTangentialWeight;
      const mixedZ = normalizedRadialZ * this.spinKnockback.pulseRadialWeight
        + normalizedRadialX * this.spinKnockback.pulseTangentialWeight;
      const mixedLength = Math.hypot(mixedX, mixedZ);
      if (mixedLength > 0.0001) {
        directionX = mixedX / mixedLength;
        directionZ = mixedZ / mixedLength;
      }
    }
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
    event.knockbackSpeed = getHammerKnockbackSpeed(
      kind,
      definition.knockbackImpulse,
      actionState.progress,
      this.spinKnockback,
    );
    event.knockbackDuration = spin
      ? this.spinKnockback.durationSeconds
      : KNOCKBACK_DURATION_SECONDS;
    event.launchHeight = kind === BattlefieldWeaponHitKind.Uppercut
      ? SLEDGEHAMMER_PROGRESSION.uppercutLaunchHeight
      : 0;
    event.kineticSkillSequence = spin ? actionState.skillSequenceId : 0;
    event.kineticDamageBudget = spin
      ? definition.baseDamage * SPIN_KINETIC_DAMAGE_BUDGET_SCALE
      : 0;
    this.events.append(event);
  }
}
