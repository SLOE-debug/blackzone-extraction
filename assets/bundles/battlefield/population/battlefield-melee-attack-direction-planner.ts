import { MonsterLifecycleState } from '../../../core/contracts/monster-lifecycle';
import { moveAngleTowards } from '../../../core/math/scalar';
import { type PlanarCrowdCandidateBuffer } from '../../../core/monsters/crowd/planar-crowd-candidate-buffer';
import {
  MeleeTargetSwitchReason,
  type BattlefieldMeleeAttackDirectionQuery,
  type MutableBattlefieldMeleeAttackDirection,
} from '../combat/battlefield-melee-attack-direction';
import {
  absoluteAngleDifference,
  calculateMeleeDirectionScore,
  createMeleeDirectionScore,
  isBetterMeleeAnchor,
  isBetterMeleeDirectionScore,
  resetMeleeDirectionScore,
  shouldSwitchMeleeAttackDirection,
  validateMeleeAttackDirectionQuery,
  type MutableMeleeDirectionScore,
} from './battlefield-melee-attack-direction-score';
import { type BattlefieldMonsterTargetGroup } from './battlefield-monster-target-group';

const DIRECTION_SAMPLE_COUNT = 24;
const MAXIMUM_EXACT_DIRECTION_COUNT = 5;
const MAXIMUM_DIRECTION_COUNT = DIRECTION_SAMPLE_COUNT + MAXIMUM_EXACT_DIRECTION_COUNT;
const DIRECTION_EPSILON = 0.000001;
const DIRECTION_DEDUPLICATION_EPSILON = 0.0001;

/**
 * 在预分配的 Crowd 候选上规划大锤横扫方向。
 *
 * 规划器只在攻击决策时执行；候选快照、方向集合和评分结果均长期复用。
 */
export class BattlefieldMeleeAttackDirectionPlanner {
  private readonly populationIds: Uint32Array;
  private readonly entityIds: Uint32Array;
  private readonly radii: Float32Array;
  private readonly distances: Float32Array;
  private readonly directionX: Float32Array;
  private readonly directionZ: Float32Array;
  private readonly acquirable: Uint8Array;
  private readonly candidateHeadings = new Float64Array(MAXIMUM_DIRECTION_COUNT);
  private readonly best = createMeleeDirectionScore();
  private readonly preferred = createMeleeDirectionScore();
  private targetCount = 0;
  private headingCount = 0;
  private preferredTargetValid = false;
  private preferredTargetOutOfRange = false;

  constructor(capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new Error('近战方向规划容量必须为正安全整数。');
    }
    this.populationIds = new Uint32Array(capacity);
    this.entityIds = new Uint32Array(capacity);
    this.radii = new Float32Array(capacity);
    this.distances = new Float32Array(capacity);
    this.directionX = new Float32Array(capacity);
    this.directionZ = new Float32Array(capacity);
    this.acquirable = new Uint8Array(capacity);
  }

  /** 从一次共享宽相位结果写出带目标迟滞的最佳攻击方向。 */
  public write(
    query: Readonly<BattlefieldMeleeAttackDirectionQuery>,
    groups: readonly BattlefieldMonsterTargetGroup[],
    candidates: Readonly<PlanarCrowdCandidateBuffer>,
    worldScale: number,
    result: MutableBattlefieldMeleeAttackDirection,
  ): boolean {
    validateMeleeAttackDirectionQuery(query);
    this.collectTargets(query, groups, candidates, worldScale);
    this.collectCandidateHeadings(query);
    resetMeleeDirectionScore(this.best);
    resetMeleeDirectionScore(this.preferred);
    for (let index = 0; index < this.headingCount; index++) {
      const heading = this.candidateHeadings[index] ?? 0;
      this.evaluateDirection(query, heading, false, this.best);
      if (this.preferredTargetValid) {
        this.evaluateDirection(query, heading, true, this.preferred);
      }
    }
    return this.writeSelectedResult(query, result);
  }

  private collectTargets(
    query: Readonly<BattlefieldMeleeAttackDirectionQuery>,
    groups: readonly BattlefieldMonsterTargetGroup[],
    candidates: Readonly<PlanarCrowdCandidateBuffer>,
    worldScale: number,
  ): void {
    this.targetCount = 0;
    this.inspectPreferredTarget(query, groups, worldScale);
    for (let index = 0; index < candidates.count; index++) {
      const populationId = candidates.populationIds[index] ?? 0;
      const entityId = candidates.entityIndices[index] ?? 0;
      const group = findGroup(groups, populationId);
      const crowd = group?.crowdPopulation;
      if (crowd === undefined
        || entityId >= crowd.count
        || (crowd.lifecycle[entityId] as MonsterLifecycleState) !== MonsterLifecycleState.Alive
        || (crowd.participation[entityId] ?? 0) === 0) {
        continue;
      }
      const x = (crowd.x[entityId] ?? 0) * worldScale;
      const z = -(crowd.y[entityId] ?? 0) * worldScale;
      const deltaX = x - query.originX;
      const deltaZ = z - query.originZ;
      const distance = Math.hypot(deltaX, deltaZ);
      const preferred = populationId === query.preferredPopulationId
        && entityId === query.preferredEntityId;
      const targetAcquirable = distance <= query.acquireRadius;
      if ((!preferred || !this.preferredTargetValid) && !targetAcquirable) {
        continue;
      }
      if (this.targetCount >= this.populationIds.length) {
        throw new Error('近战方向规划候选容量不足。');
      }
      const targetIndex = this.targetCount++;
      const inverseDistance = distance > DIRECTION_EPSILON ? 1 / distance : 0;
      this.populationIds[targetIndex] = populationId;
      this.entityIds[targetIndex] = entityId;
      this.radii[targetIndex] = (crowd.radius[entityId] ?? 0) * worldScale;
      this.distances[targetIndex] = distance;
      this.directionX[targetIndex] = distance > DIRECTION_EPSILON
        ? deltaX * inverseDistance
        : Math.sin(query.currentHeading);
      this.directionZ[targetIndex] = distance > DIRECTION_EPSILON
        ? deltaZ * inverseDistance
        : Math.cos(query.currentHeading);
      this.acquirable[targetIndex] = targetAcquirable ? 1 : 0;
    }
  }

  private inspectPreferredTarget(
    query: Readonly<BattlefieldMeleeAttackDirectionQuery>,
    groups: readonly BattlefieldMonsterTargetGroup[],
    worldScale: number,
  ): void {
    this.preferredTargetValid = false;
    this.preferredTargetOutOfRange = false;
    if (query.preferredPopulationId < 0 || query.preferredEntityId < 0) {
      return;
    }
    const crowd = findGroup(groups, query.preferredPopulationId)?.crowdPopulation;
    const entityId = query.preferredEntityId;
    if (crowd === undefined
      || entityId >= crowd.count
      || (crowd.lifecycle[entityId] as MonsterLifecycleState) !== MonsterLifecycleState.Alive
      || (crowd.participation[entityId] ?? 0) === 0) {
      return;
    }
    const deltaX = (crowd.x[entityId] ?? 0) * worldScale - query.originX;
    const deltaZ = -(crowd.y[entityId] ?? 0) * worldScale - query.originZ;
    if (deltaX * deltaX + deltaZ * deltaZ > query.releaseRadius * query.releaseRadius) {
      this.preferredTargetOutOfRange = true;
      return;
    }
    this.preferredTargetValid = true;
  }

  private collectCandidateHeadings(query: Readonly<BattlefieldMeleeAttackDirectionQuery>): void {
    this.headingCount = 0;
    for (let index = 0; index < DIRECTION_SAMPLE_COUNT; index++) {
      this.includeHeading(query, index * Math.PI * 2 / DIRECTION_SAMPLE_COUNT);
    }
    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    let preferredIndex = -1;
    for (let index = 0; index < this.targetCount; index++) {
      if ((this.acquirable[index] ?? 0) !== 0
        && (this.distances[index] ?? 0) < nearestDistance) {
        nearestIndex = index;
        nearestDistance = this.distances[index] ?? 0;
      }
      if ((this.populationIds[index] ?? 0) === query.preferredPopulationId
        && (this.entityIds[index] ?? 0) === query.preferredEntityId) {
        preferredIndex = index;
      }
    }
    if (preferredIndex >= 0) {
      this.includeTargetHeading(query, preferredIndex);
    }
    if (nearestIndex >= 0) {
      this.includeTargetHeading(query, nearestIndex);
      // 当前没有类型化威胁等级，最近目标同时充当精确威胁方向。
      this.includeTargetHeading(query, nearestIndex);
    }
    this.includeHeading(query, query.currentHeading);
    if (query.previousAttackHeading !== null) {
      this.includeHeading(query, query.previousAttackHeading);
    }
  }

  private includeTargetHeading(
    query: Readonly<BattlefieldMeleeAttackDirectionQuery>,
    targetIndex: number,
  ): void {
    this.includeHeading(
      query,
      Math.atan2(this.directionX[targetIndex] ?? 0, this.directionZ[targetIndex] ?? 1),
    );
  }

  private includeHeading(
    query: Readonly<BattlefieldMeleeAttackDirectionQuery>,
    candidateHeading: number,
  ): void {
    const heading = query.previousAttackHeading === null
      ? candidateHeading
      : moveAngleTowards(
        query.previousAttackHeading,
        candidateHeading,
        query.maximumTurnRadians,
      );
    for (let index = 0; index < this.headingCount; index++) {
      if (absoluteAngleDifference(this.candidateHeadings[index] ?? 0, heading)
        <= DIRECTION_DEDUPLICATION_EPSILON) {
        return;
      }
    }
    if (this.headingCount >= this.candidateHeadings.length) {
      throw new Error('近战方向候选容量不足。');
    }
    this.candidateHeadings[this.headingCount++] = heading;
  }

  private evaluateDirection(
    query: Readonly<BattlefieldMeleeAttackDirectionQuery>,
    heading: number,
    requirePreferred: boolean,
    best: MutableMeleeDirectionScore,
  ): void {
    const directionX = Math.sin(heading);
    const directionZ = Math.cos(heading);
    const minimumAlignment = Math.cos(query.attackArcRadians * 0.5);
    let expectedHitCount = 0;
    let closeThreatCount = 0;
    let hitAlignmentTotal = 0;
    let preferredIncluded = false;
    let anchorIndex = -1;
    let anchorAlignment = Number.NEGATIVE_INFINITY;
    let anchorDistance = Number.POSITIVE_INFINITY;
    let preferredAnchorIndex = -1;
    for (let index = 0; index < this.targetCount; index++) {
      const alignment = (this.directionX[index] ?? 0) * directionX
        + (this.directionZ[index] ?? 0) * directionZ;
      if (alignment < minimumAlignment) {
        continue;
      }
      const preferred = (this.populationIds[index] ?? 0) === query.preferredPopulationId
        && (this.entityIds[index] ?? 0) === query.preferredEntityId;
      if (preferred) {
        preferredAnchorIndex = index;
      }
      if ((this.acquirable[index] ?? 0) !== 0
        && isBetterMeleeAnchor(
          index,
          alignment,
          this.distances[index] ?? 0,
          anchorIndex,
          anchorAlignment,
          anchorDistance,
          this.populationIds,
          this.entityIds,
        )) {
        anchorIndex = index;
        anchorAlignment = alignment;
        anchorDistance = this.distances[index] ?? 0;
      }
      const distance = this.distances[index] ?? 0;
      if (distance > query.attackReach + (this.radii[index] ?? 0)) {
        continue;
      }
      expectedHitCount++;
      hitAlignmentTotal += alignment;
      if (distance < query.closeThreatRadius) {
        closeThreatCount++;
      }
      preferredIncluded ||= preferred;
    }
    const resolvedAnchorIndex = preferredAnchorIndex >= 0
      ? preferredAnchorIndex
      : anchorIndex;
    if (resolvedAnchorIndex < 0 || (requirePreferred && preferredAnchorIndex < 0)) {
      return;
    }
    const resolvedAnchorAlignment = (this.directionX[resolvedAnchorIndex] ?? 0) * directionX
      + (this.directionZ[resolvedAnchorIndex] ?? 0) * directionZ;
    const eliteTargetCount = 0;
    const score = calculateMeleeDirectionScore(
      query,
      heading,
      expectedHitCount,
      closeThreatCount,
      preferredIncluded,
      eliteTargetCount,
      expectedHitCount > 0 ? hitAlignmentTotal / expectedHitCount : resolvedAnchorAlignment,
    );
    if (!isBetterMeleeDirectionScore(
      score,
      expectedHitCount,
      heading,
      resolvedAnchorIndex,
      best,
      this.populationIds,
      this.entityIds,
    )) {
      return;
    }
    best.directionX = directionX;
    best.directionZ = directionZ;
    best.heading = heading;
    best.expectedHitCount = expectedHitCount;
    best.closeThreatCount = closeThreatCount;
    best.eliteTargetCount = eliteTargetCount;
    best.score = score;
    best.anchorPopulationId = this.populationIds[resolvedAnchorIndex] ?? 0;
    best.anchorEntityId = this.entityIds[resolvedAnchorIndex] ?? 0;
    best.targeted = true;
  }

  private writeSelectedResult(
    query: Readonly<BattlefieldMeleeAttackDirectionQuery>,
    result: MutableBattlefieldMeleeAttackDirection,
  ): boolean {
    result.preferredTargetValid = this.preferredTargetValid;
    result.preferredExpectedHitCount = this.preferred.expectedHitCount;
    result.preferredScore = this.preferred.score;
    if (!this.best.targeted) {
      resetPublicResult(result);
      result.preferredTargetValid = this.preferredTargetValid;
      result.targetSwitchReason = MeleeTargetSwitchReason.NoTargetFallback;
      return false;
    }
    const hasPreferred = query.preferredPopulationId >= 0 && query.preferredEntityId >= 0;
    let selected = this.best;
    let retained = this.best.anchorPopulationId === query.preferredPopulationId
      && this.best.anchorEntityId === query.preferredEntityId;
    let reason = hasPreferred
      ? this.preferredTargetOutOfRange
        ? MeleeTargetSwitchReason.PreferredOutOfRange
        : this.preferredTargetValid
          ? MeleeTargetSwitchReason.None
          : MeleeTargetSwitchReason.PreferredInvalid
      : MeleeTargetSwitchReason.InitialAcquire;
    if (this.preferredTargetValid && this.preferred.targeted && !retained) {
      if (!shouldSwitchMeleeAttackDirection(
        this.preferred.score,
        this.best.score,
        this.preferred.expectedHitCount,
      )) {
        selected = this.preferred;
        retained = true;
      } else {
        reason = MeleeTargetSwitchReason.BetterCluster;
      }
    }
    writePublicResult(result, selected);
    result.preferredTargetValid = this.preferredTargetValid;
    result.preferredExpectedHitCount = this.preferred.expectedHitCount;
    result.preferredScore = this.preferred.score;
    result.targetRetained = retained;
    result.targetSwitchReason = reason;
    return true;
  }
}

function findGroup(
  groups: readonly BattlefieldMonsterTargetGroup[],
  populationId: number,
): BattlefieldMonsterTargetGroup | null {
  for (const group of groups) {
    if (group.populationId === populationId) {
      return group;
    }
  }
  return null;
}


function resetPublicResult(result: MutableBattlefieldMeleeAttackDirection): void {
  result.directionX = 0;
  result.directionZ = 1;
  result.heading = 0;
  result.expectedHitCount = 0;
  result.closeThreatCount = 0;
  result.eliteTargetCount = 0;
  result.score = 0;
  result.anchorPopulationId = -1;
  result.anchorEntityId = -1;
  result.targeted = false;
  result.preferredTargetValid = false;
  result.preferredExpectedHitCount = 0;
  result.preferredScore = 0;
  result.targetRetained = false;
  result.targetSwitchReason = MeleeTargetSwitchReason.NoTargetFallback;
}

function writePublicResult(
  result: MutableBattlefieldMeleeAttackDirection,
  source: Readonly<MutableMeleeDirectionScore>,
): void {
  result.directionX = source.directionX;
  result.directionZ = source.directionZ;
  result.heading = source.heading;
  result.expectedHitCount = source.expectedHitCount;
  result.closeThreatCount = source.closeThreatCount;
  result.eliteTargetCount = source.eliteTargetCount;
  result.score = source.score;
  result.anchorPopulationId = source.anchorPopulationId;
  result.anchorEntityId = source.anchorEntityId;
  result.targeted = source.targeted;
}
