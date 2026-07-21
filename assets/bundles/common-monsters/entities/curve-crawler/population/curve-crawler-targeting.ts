import {
  type MutablePlanarTargetResult,
  type PlanarTargetQuery,
} from '../../../../../core/contracts/planar-target';
import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { calculateCurveCrawlerAimElevation } from '../model/curve-crawler-combat-volume';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

const DIRECTION_EPSILON = 0.0001;

/** 在 Curve Crawler 群体的连续状态中执行无分配辅助瞄准查询。 */
export class CurveCrawlerTargeting {
  /** 选择瞄准锥内角度最接近输入方向、距离次优的存活实体。 */
  public findBest(
    state: CurveCrawlerState,
    query: Readonly<PlanarTargetQuery>,
    result: MutablePlanarTargetResult,
  ): boolean {
    validateQuery(query);
    const { identity, transform, morphology, vitality, animation } = state.data;
    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let index = 0; index < state.count; index++) {
      if ((vitality.state[index] as MonsterLifecycleState) !== MonsterLifecycleState.Alive) {
        continue;
      }
      const deltaX = (transform.x[index] ?? 0) - query.originX;
      const deltaY = (transform.y[index] ?? 0) - query.originY;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      if (distanceSquared <= DIRECTION_EPSILON * DIRECTION_EPSILON
        || distanceSquared > query.maximumDistance * query.maximumDistance) {
        continue;
      }
      const forwardDistance = deltaX * query.directionX + deltaY * query.directionY;
      if (query.minimumAlignment >= 0
        && (forwardDistance < 0
          || forwardDistance * forwardDistance
            < query.minimumAlignment * query.minimumAlignment * distanceSquared)) {
        continue;
      }
      const distance = Math.sqrt(distanceSquared);
      const alignment = forwardDistance / distance;
      if (alignment < query.minimumAlignment) {
        continue;
      }
      const angularPenalty = 1 - alignment;
      const distancePenalty = distance / query.maximumDistance * 0.08;
      const score = angularPenalty + distancePenalty;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    if (bestIndex < 0) {
      return false;
    }
    result.entityId = identity.id[bestIndex] ?? bestIndex;
    result.x = transform.x[bestIndex] ?? 0;
    result.y = transform.y[bestIndex] ?? 0;
    result.elevation = calculateCurveCrawlerAimElevation(
      morphology.bodyWidth[bestIndex] ?? 0,
      animation.bodyPulse[bestIndex] ?? 0,
      animation.crouchAmount[bestIndex] ?? 0,
      animation.biteAmount[bestIndex] ?? 0,
    );
    return true;
  }
}

/** 验证目标查询的方向、距离和点积阈值。 */
function validateQuery(query: Readonly<PlanarTargetQuery>): void {
  if (!Number.isFinite(query.originX)
    || !Number.isFinite(query.originY)
    || !Number.isFinite(query.directionX)
    || !Number.isFinite(query.directionY)
    || !Number.isFinite(query.maximumDistance)
    || !Number.isFinite(query.minimumAlignment)) {
    throw new Error('Curve Crawler 目标查询参数必须是有限数值。');
  }
  const directionLength = Math.hypot(query.directionX, query.directionY);
  if (Math.abs(directionLength - 1) > 0.001
    || query.maximumDistance <= 0
    || query.minimumAlignment < -1
    || query.minimumAlignment > 1) {
    throw new Error('Curve Crawler 目标查询方向或范围无效。');
  }
}
