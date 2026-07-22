import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import {
  type MutablePlanarTargetResult,
  type PlanarTargetQuery,
} from '../../../../../core/contracts/planar-target';
import { type VenomLobberState } from '../model/venom-lobber-state';

const DIRECTION_EPSILON = 0.0001;

/** 在 Venom Lobber SoA 中执行无分配辅助瞄准查询。 */
export class VenomLobberTargeting {
  public findBest(
    state: VenomLobberState,
    query: Readonly<PlanarTargetQuery>,
    result: MutablePlanarTargetResult,
  ): boolean {
    validateQuery(query);
    const { identity, transform, morphology, vitality } = state.data;
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
      const score = 1 - alignment + distance / query.maximumDistance * 0.065;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    if (bestIndex < 0) {
      return false;
    }
    const scale = morphology.scale[bestIndex] ?? 1;
    result.entityId = identity.id[bestIndex] ?? bestIndex;
    result.x = transform.x[bestIndex] ?? 0;
    result.y = transform.y[bestIndex] ?? 0;
    result.elevation = 2.65 * scale;
    return true;
  }

  /** 只评估共享空间索引给出的单一实体。 */
  public findEntity(
    state: VenomLobberState,
    entityIndex: number,
    query: Readonly<PlanarTargetQuery>,
    result: MutablePlanarTargetResult,
  ): boolean {
    validateQuery(query);
    if (!Number.isSafeInteger(entityIndex) || entityIndex < 0 || entityIndex >= state.count) {
      throw new Error('Venom Lobber 瞄准实体索引越界。');
    }
    const { identity, transform, morphology, vitality } = state.data;
    if ((vitality.state[entityIndex] as MonsterLifecycleState)
      !== MonsterLifecycleState.Alive) {
      return false;
    }
    const deltaX = (transform.x[entityIndex] ?? 0) - query.originX;
    const deltaY = (transform.y[entityIndex] ?? 0) - query.originY;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;
    if (distanceSquared <= DIRECTION_EPSILON * DIRECTION_EPSILON
      || distanceSquared > query.maximumDistance * query.maximumDistance) {
      return false;
    }
    const alignment = (deltaX * query.directionX + deltaY * query.directionY)
      / Math.sqrt(distanceSquared);
    if (alignment < query.minimumAlignment) {
      return false;
    }
    result.entityId = identity.id[entityIndex] ?? entityIndex;
    result.x = transform.x[entityIndex] ?? 0;
    result.y = transform.y[entityIndex] ?? 0;
    result.elevation = 2.65 * (morphology.scale[entityIndex] ?? 1);
    return true;
  }
}

function validateQuery(query: Readonly<PlanarTargetQuery>): void {
  if (!Number.isFinite(query.originX)
    || !Number.isFinite(query.originY)
    || !Number.isFinite(query.directionX)
    || !Number.isFinite(query.directionY)
    || !Number.isFinite(query.maximumDistance)
    || !Number.isFinite(query.minimumAlignment)
    || Math.abs(Math.hypot(query.directionX, query.directionY) - 1) > 0.001
    || query.maximumDistance <= 0
    || query.minimumAlignment < -1
    || query.minimumAlignment > 1) {
    throw new Error('Venom Lobber 目标查询参数无效。');
  }
}
