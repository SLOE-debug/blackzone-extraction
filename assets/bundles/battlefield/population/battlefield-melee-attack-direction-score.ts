import { type BattlefieldMeleeAttackDirectionQuery } from '../combat/battlefield-melee-attack-direction';

const HIT_COUNT_WEIGHT = 10;
const CLOSE_THREAT_WEIGHT = 4;
const PREFERRED_TARGET_BONUS = 8;
const ELITE_TARGET_WEIGHT = 6;
const ROTATION_COST_WEIGHT = 1.5;
const HEADING_CONTINUITY_WEIGHT = 2;
const CENTERLINE_ALIGNMENT_WEIGHT = 4;
export const TARGET_SWITCH_SCORE_RATIO = 1.2;

/** 单个候选方向的可复用评分结果。 */
export interface MutableMeleeDirectionScore {
  directionX: number;
  directionZ: number;
  heading: number;
  expectedHitCount: number;
  closeThreatCount: number;
  eliteTargetCount: number;
  score: number;
  anchorPopulationId: number;
  anchorEntityId: number;
  targeted: boolean;
}

/** 按覆盖数量、近身威胁、稳定目标与转向连续性计算方向得分。 */
export function calculateMeleeDirectionScore(
  query: Readonly<BattlefieldMeleeAttackDirectionQuery>,
  heading: number,
  expectedHitCount: number,
  closeThreatCount: number,
  preferredIncluded: boolean,
  eliteTargetCount: number,
  meanHitAlignment: number,
): number {
  const continuityScore = query.previousAttackHeading === null
    ? 0
    : HEADING_CONTINUITY_WEIGHT
      * (1 - absoluteAngleDifference(query.previousAttackHeading, heading) / Math.PI);
  const rotationCost = ROTATION_COST_WEIGHT
    * absoluteAngleDifference(query.currentHeading, heading) / Math.PI;
  return expectedHitCount * HIT_COUNT_WEIGHT
    + closeThreatCount * CLOSE_THREAT_WEIGHT
    + (preferredIncluded ? PREFERRED_TARGET_BONUS : 0)
    + eliteTargetCount * ELITE_TARGET_WEIGHT
    + meanHitAlignment * CENTERLINE_ALIGNMENT_WEIGHT
    + continuityScore
    - rotationCost;
}

/** 当前方案仍能命中时，仅接受至少高出百分之二十的挑战方案。 */
export function shouldSwitchMeleeAttackDirection(
  currentScore: number,
  challengerScore: number,
  currentExpectedHitCount: number,
): boolean {
  return currentExpectedHitCount <= 0
    || challengerScore >= currentScore * TARGET_SWITCH_SCORE_RATIO;
}

/** 校验方向规划的范围、角度和稳定目标标识。 */
export function validateMeleeAttackDirectionQuery(
  query: Readonly<BattlefieldMeleeAttackDirectionQuery>,
): void {
  const previousHeadingValid = query.previousAttackHeading === null
    || Number.isFinite(query.previousAttackHeading);
  if (!Number.isFinite(query.originX)
    || !Number.isFinite(query.originZ)
    || !Number.isFinite(query.acquireRadius)
    || !Number.isFinite(query.releaseRadius)
    || !Number.isFinite(query.attackReach)
    || !Number.isFinite(query.attackArcRadians)
    || !Number.isFinite(query.closeThreatRadius)
    || !Number.isFinite(query.currentHeading)
    || !Number.isFinite(query.maximumTurnRadians)
    || !previousHeadingValid
    || query.acquireRadius <= 0
    || query.releaseRadius < query.acquireRadius
    || query.attackReach <= 0
    || query.attackArcRadians <= 0
    || query.attackArcRadians > Math.PI * 2
    || query.closeThreatRadius <= 0
    || query.maximumTurnRadians < 0
    || query.maximumTurnRadians > Math.PI
    || !Number.isSafeInteger(query.preferredPopulationId)
    || !Number.isSafeInteger(query.preferredEntityId)) {
    throw new Error('近战挥击方向查询参数无效。');
  }
}

/** 返回两个朝向之间的最短无符号夹角。 */
export function absoluteAngleDifference(first: number, second: number): number {
  return Math.abs(Math.atan2(Math.sin(second - first), Math.cos(second - first)));
}

/** 按中心线贴合、距离与稳定实体标识比较锚点。 */
export function isBetterMeleeAnchor(
  candidateIndex: number,
  candidateAlignment: number,
  candidateDistance: number,
  currentIndex: number,
  currentAlignment: number,
  currentDistance: number,
  populationIds: Uint32Array,
  entityIds: Uint32Array,
): boolean {
  return currentIndex < 0
    || candidateAlignment > currentAlignment
    || (candidateAlignment === currentAlignment && candidateDistance < currentDistance)
    || (candidateAlignment === currentAlignment && candidateDistance === currentDistance
      && isStableTargetBefore(
        populationIds[candidateIndex] ?? 0,
        entityIds[candidateIndex] ?? 0,
        populationIds[currentIndex] ?? 0,
        entityIds[currentIndex] ?? 0,
      ));
}

/** 按总分、覆盖数量、方向与实体标识稳定比较两个方向。 */
export function isBetterMeleeDirectionScore(
  score: number,
  expectedHitCount: number,
  heading: number,
  anchorIndex: number,
  best: Readonly<MutableMeleeDirectionScore>,
  populationIds: Uint32Array,
  entityIds: Uint32Array,
): boolean {
  return !best.targeted
    || score > best.score
    || (score === best.score && expectedHitCount > best.expectedHitCount)
    || (score === best.score && expectedHitCount === best.expectedHitCount
      && heading < best.heading)
    || (score === best.score && expectedHitCount === best.expectedHitCount
      && heading === best.heading
      && isStableTargetBefore(
        populationIds[anchorIndex] ?? 0,
        entityIds[anchorIndex] ?? 0,
        best.anchorPopulationId,
        best.anchorEntityId,
      ));
}

export function createMeleeDirectionScore(): MutableMeleeDirectionScore {
  const result = {} as MutableMeleeDirectionScore;
  resetMeleeDirectionScore(result);
  return result;
}

export function resetMeleeDirectionScore(result: MutableMeleeDirectionScore): void {
  result.directionX = 0;
  result.directionZ = 1;
  result.heading = 0;
  result.expectedHitCount = 0;
  result.closeThreatCount = 0;
  result.eliteTargetCount = 0;
  result.score = Number.NEGATIVE_INFINITY;
  result.anchorPopulationId = -1;
  result.anchorEntityId = -1;
  result.targeted = false;
}

function isStableTargetBefore(
  populationId: number,
  entityId: number,
  otherPopulationId: number,
  otherEntityId: number,
): boolean {
  return populationId < otherPopulationId
    || (populationId === otherPopulationId && entityId < otherEntityId);
}
