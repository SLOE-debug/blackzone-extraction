import { MonsterLifecycleState } from '../../../../core/contracts/monster-lifecycle';
import { PlanarCrowdCandidateBuffer } from '../../../../core/monsters/crowd/planar-crowd-candidate-buffer';
import { type PlanarCrowdCollisionSource } from '../../../../core/monsters/crowd/planar-crowd-separation-system';
import {
  BATTLEFIELD_KINETIC_PROPAGATION_CONFIG,
  type BattlefieldKineticPropagationConfig,
} from './battlefield-kinetic-propagation-config';
import { BattlefieldKineticPairLedger } from './battlefield-kinetic-pair-ledger';
import { type BattlefieldMonsterEffectGroupState } from './battlefield-monster-effect-state';

const VELOCITY_EPSILON = 0.0001;

/** 使用 Crowd 宽相位逐帧传播怪群动量，并限制伤害与载体规模。 */
export class BattlefieldKineticPropagationSystem {
  private readonly candidates: PlanarCrowdCandidateBuffer;
  private readonly pairs: BattlefieldKineticPairLedger;
  private elapsedSeconds = 0;
  private activeSequence = 0;
  private carrierCount = 0;

  constructor(
    private readonly collisionSource: PlanarCrowdCollisionSource,
    private readonly config: Readonly<BattlefieldKineticPropagationConfig>
      = BATTLEFIELD_KINETIC_PROPAGATION_CONFIG,
  ) {
    this.candidates = new PlanarCrowdCandidateBuffer(config.candidateCapacity);
    this.pairs = new BattlefieldKineticPairLedger(config.pairLedgerCapacity);
  }

  public advanceTime(deltaTime: number): void {
    this.elapsedSeconds += deltaTime;
  }

  /** 直接旋风命中激活动量载体；同一技能重复命中不会重置已消耗预算。 */
  public applyDirectCarrier(
    state: BattlefieldMonsterEffectGroupState,
    entityId: number,
    skillSequenceId: number,
    baseDamage: number,
    damageBudget: number,
    frameId: number,
  ): boolean {
    if (this.activeSequence !== skillSequenceId) {
      this.activeSequence = skillSequenceId;
      this.carrierCount = 0;
      this.pairs.beginSequence(skillSequenceId);
    }
    const knownCarrier = (state.kineticSequence[entityId] ?? 0) === skillSequenceId;
    if (!knownCarrier && this.carrierCount >= this.config.maximumCarriersPerSkill) {
      return false;
    }
    if (!knownCarrier) {
      this.carrierCount++;
      state.kineticDamageBudget[entityId] = damageBudget;
    }
    state.kineticSequence[entityId] = skillSequenceId;
    state.kineticRemaining[entityId] = this.config.durationSeconds;
    state.kineticGeneration[entityId] = 0;
    state.kineticBaseDamage[entityId] = baseDamage;
    state.kineticActivatedFrame[entityId] = frameId;
    const crowd = state.group.crowdPopulation;
    state.kineticSweepStartX[entityId] = crowd.x[entityId] ?? 0;
    state.kineticSweepStartY[entityId] = crowd.y[entityId] ?? 0;
    return true;
  }

  /** 新载体只从下一帧开始传播，避免同帧递归穿透整个怪群。 */
  public resolve(
    states: readonly BattlefieldMonsterEffectGroupState[],
    frameId: number,
  ): void {
    if (this.activeSequence <= 0) {
      return;
    }
    for (let stateIndex = 0; stateIndex < states.length; stateIndex++) {
      const state = states[stateIndex];
      if (state === undefined) {
        continue;
      }
      const crowd = state.group.crowdPopulation;
      for (let entityId = 0; entityId < crowd.count; entityId++) {
        if ((state.kineticSequence[entityId] ?? 0) !== this.activeSequence
          || (state.kineticRemaining[entityId] ?? 0) <= 0
          || (state.kineticActivatedFrame[entityId] ?? 0) === frameId
          || (crowd.lifecycle[entityId] as MonsterLifecycleState)
            !== MonsterLifecycleState.Alive) {
          continue;
        }
        this.resolveCarrier(states, state, entityId, frameId);
      }
    }
  }

  private resolveCarrier(
    states: readonly BattlefieldMonsterEffectGroupState[],
    sourceState: BattlefieldMonsterEffectGroupState,
    sourceEntity: number,
    frameId: number,
  ): void {
    const sourceSpeed = readCurrentKnockbackSpeed(sourceState, sourceEntity);
    if (sourceSpeed < this.config.minimumSpeed) {
      return;
    }
    const crowd = sourceState.group.crowdPopulation;
    const startX = sourceState.kineticSweepStartX[sourceEntity] ?? 0;
    const startY = sourceState.kineticSweepStartY[sourceEntity] ?? 0;
    const endX = crowd.x[sourceEntity] ?? startX;
    const endY = crowd.y[sourceEntity] ?? startY;
    this.collisionSource.collectSegmentCandidates(
      startX,
      startY,
      endX,
      endY,
      crowd.radius[sourceEntity] ?? 0,
      this.candidates,
    );
    for (let candidateIndex = 0; candidateIndex < this.candidates.count; candidateIndex++) {
      const targetPopulationId = this.candidates.populationIds[candidateIndex] ?? 0;
      const targetEntity = this.candidates.entityIndices[candidateIndex] ?? 0;
      if (targetPopulationId === sourceState.group.populationId
        && targetEntity === sourceEntity) {
        continue;
      }
      const targetState = findState(states, targetPopulationId);
      if (targetState === null) {
        continue;
      }
      this.resolveCandidate(
        sourceState,
        sourceEntity,
        targetState,
        targetEntity,
        startX,
        startY,
        endX,
        endY,
        frameId,
      );
    }
  }

  private resolveCandidate(
    sourceState: BattlefieldMonsterEffectGroupState,
    sourceEntity: number,
    targetState: BattlefieldMonsterEffectGroupState,
    targetEntity: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    frameId: number,
  ): void {
    const targetCrowd = targetState.group.crowdPopulation;
    if ((targetCrowd.lifecycle[targetEntity] as MonsterLifecycleState)
        !== MonsterLifecycleState.Alive
      || (targetCrowd.participation[targetEntity] ?? 0) === 0) {
      return;
    }
    const targetX = targetCrowd.x[targetEntity] ?? 0;
    const targetY = targetCrowd.y[targetEntity] ?? 0;
    const sourceRadius = sourceState.group.crowdPopulation.radius[sourceEntity] ?? 0;
    const contactRadius = sourceRadius + (targetCrowd.radius[targetEntity] ?? 0);
    if (distanceSquaredToSegment(targetX, targetY, startX, startY, endX, endY)
      > contactRadius * contactRadius) {
      return;
    }
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
    const nearestProgress = segmentLengthSquared <= VELOCITY_EPSILON
      ? 0
      : Math.max(0, Math.min(1,
        ((targetX - startX) * segmentX + (targetY - startY) * segmentY)
          / segmentLengthSquared));
    let normalLocalX = targetX - (startX + segmentX * nearestProgress);
    let normalLocalY = targetY - (startY + segmentY * nearestProgress);
    let normalLength = Math.hypot(normalLocalX, normalLocalY);
    if (normalLength <= VELOCITY_EPSILON) {
      normalLocalX = sourceState.knockbackDirectionX[sourceEntity] ?? 1;
      normalLocalY = -(sourceState.knockbackDirectionZ[sourceEntity] ?? 0);
      normalLength = 1;
    }
    const normalX = normalLocalX / normalLength;
    const normalZ = -normalLocalY / normalLength;
    const sourceSpeed = readCurrentKnockbackSpeed(sourceState, sourceEntity);
    const targetSpeed = readCurrentKnockbackSpeed(targetState, targetEntity);
    const sourceVelocityX = (sourceState.knockbackDirectionX[sourceEntity] ?? 0) * sourceSpeed;
    const sourceVelocityZ = (sourceState.knockbackDirectionZ[sourceEntity] ?? 0) * sourceSpeed;
    const targetVelocityX = (targetState.knockbackDirectionX[targetEntity] ?? 0) * targetSpeed;
    const targetVelocityZ = (targetState.knockbackDirectionZ[targetEntity] ?? 0) * targetSpeed;
    const closingSpeed = (sourceVelocityX - targetVelocityX) * normalX
      + (sourceVelocityZ - targetVelocityZ) * normalZ;
    if (closingSpeed < this.config.minimumSpeed) {
      return;
    }
    const pair = this.pairs.resolve(
      sourceState.group.populationId,
      sourceEntity,
      targetState.group.populationId,
      targetEntity,
      this.activeSequence,
      this.elapsedSeconds,
      this.config.pairCooldownSeconds,
    );
    if (!pair.propagationAllowed) {
      return;
    }
    if (pair.damageAllowed) {
      this.applyCollisionDamage(sourceState, sourceEntity, targetState, targetEntity, closingSpeed);
    }
    const transferredSpeed = closingSpeed
      * this.config.transferRatio
      * targetState.group.launchResponse.knockbackScale;
    writeKnockbackVelocity(
      targetState,
      targetEntity,
      targetVelocityX + normalX * transferredSpeed,
      targetVelocityZ + normalZ * transferredSpeed,
      this.config.maximumSpeed,
    );
    writeKnockbackVelocity(
      sourceState,
      sourceEntity,
      sourceVelocityX * this.config.sourceRetention,
      sourceVelocityZ * this.config.sourceRetention,
      this.config.maximumSpeed,
    );
    this.propagateCarrier(sourceState, sourceEntity, targetState, targetEntity, frameId);
  }

  private applyCollisionDamage(
    sourceState: BattlefieldMonsterEffectGroupState,
    sourceEntity: number,
    targetState: BattlefieldMonsterEffectGroupState,
    targetEntity: number,
    closingSpeed: number,
  ): void {
    const normalizedSpeed = Math.max(
      0,
      Math.min(1, closingSpeed / this.config.collisionDamageMaximumSpeed),
    );
    const damageScale = this.config.collisionDamageMinimumScale
      + (this.config.collisionDamageMaximumScale - this.config.collisionDamageMinimumScale)
        * normalizedSpeed;
    const requestedDamage = (sourceState.kineticBaseDamage[sourceEntity] ?? 0) * damageScale;
    const appliedDamage = Math.min(
      requestedDamage,
      sourceState.kineticDamageBudget[sourceEntity] ?? 0,
    );
    if (appliedDamage <= 0) {
      return;
    }
    sourceState.kineticDamageBudget[sourceEntity] = Math.max(
      0,
      (sourceState.kineticDamageBudget[sourceEntity] ?? 0) - appliedDamage,
    );
    targetState.group.damageMonster(targetEntity, appliedDamage);
  }

  private propagateCarrier(
    sourceState: BattlefieldMonsterEffectGroupState,
    sourceEntity: number,
    targetState: BattlefieldMonsterEffectGroupState,
    targetEntity: number,
    frameId: number,
  ): void {
    const generation = (sourceState.kineticGeneration[sourceEntity] ?? 0) + 1;
    if (generation > this.config.maximumGeneration) {
      return;
    }
    const targetKnownCarrier = (targetState.kineticSequence[targetEntity] ?? 0)
      === this.activeSequence;
    if (!targetKnownCarrier && this.carrierCount >= this.config.maximumCarriersPerSkill) {
      return;
    }
    if (!targetKnownCarrier) {
      this.carrierCount++;
      const transferableBudget = (sourceState.kineticDamageBudget[sourceEntity] ?? 0) * 0.5;
      sourceState.kineticDamageBudget[sourceEntity] = transferableBudget;
      targetState.kineticDamageBudget[targetEntity] = transferableBudget;
    }
    targetState.kineticSequence[targetEntity] = this.activeSequence;
    targetState.kineticRemaining[targetEntity] = Math.max(
      targetState.kineticRemaining[targetEntity] ?? 0,
      (sourceState.kineticRemaining[sourceEntity] ?? 0) * 0.82,
    );
    targetState.kineticGeneration[targetEntity] = generation;
    targetState.kineticBaseDamage[targetEntity] = sourceState.kineticBaseDamage[sourceEntity] ?? 0;
    targetState.kineticActivatedFrame[targetEntity] = frameId;
    const crowd = targetState.group.crowdPopulation;
    targetState.kineticSweepStartX[targetEntity] = crowd.x[targetEntity] ?? 0;
    targetState.kineticSweepStartY[targetEntity] = crowd.y[targetEntity] ?? 0;
  }
}

function findState(
  states: readonly BattlefieldMonsterEffectGroupState[],
  populationId: number,
): BattlefieldMonsterEffectGroupState | null {
  for (let index = 0; index < states.length; index++) {
    const state = states[index];
    if (state?.group.populationId === populationId) {
      return state;
    }
  }
  return null;
}

function readCurrentKnockbackSpeed(
  state: BattlefieldMonsterEffectGroupState,
  entityId: number,
): number {
  const remaining = state.knockbackRemaining[entityId] ?? 0;
  const duration = Math.max(state.knockbackDuration[entityId] ?? 0, VELOCITY_EPSILON);
  return (state.knockbackSpeed[entityId] ?? 0) * remaining / duration;
}

function writeKnockbackVelocity(
  state: BattlefieldMonsterEffectGroupState,
  entityId: number,
  velocityX: number,
  velocityZ: number,
  maximumSpeed: number,
): void {
  const rawSpeed = Math.hypot(velocityX, velocityZ);
  if (rawSpeed <= VELOCITY_EPSILON) {
    state.knockbackSpeed[entityId] = 0;
    state.knockbackRemaining[entityId] = 0;
    state.knockbackDuration[entityId] = 0;
    return;
  }
  const speed = Math.min(rawSpeed, maximumSpeed);
  state.knockbackDirectionX[entityId] = velocityX / rawSpeed;
  state.knockbackDirectionZ[entityId] = velocityZ / rawSpeed;
  state.knockbackSpeed[entityId] = speed;
  const remaining = Math.max(state.knockbackRemaining[entityId] ?? 0, 0.2);
  state.knockbackRemaining[entityId] = remaining;
  state.knockbackDuration[entityId] = remaining;
}

function distanceSquaredToSegment(
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  const progress = lengthSquared <= VELOCITY_EPSILON
    ? 0
    : Math.max(0, Math.min(1,
      ((pointX - startX) * segmentX + (pointY - startY) * segmentY) / lengthSquared));
  const deltaX = pointX - (startX + segmentX * progress);
  const deltaY = pointY - (startY + segmentY * progress);
  return deltaX * deltaX + deltaY * deltaY;
}
