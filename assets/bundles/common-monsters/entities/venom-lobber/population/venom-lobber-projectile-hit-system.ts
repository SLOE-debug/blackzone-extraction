import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import {
  type MutablePlanarMonsterHitResult,
  type PlanarMonsterHitQuery,
} from '../../../../../core/contracts/monster-hit';
import { type VenomLobberState } from '../model/venom-lobber-state';

const SEGMENT_EPSILON = 0.000001;

/** 使用覆盖躯干、头部与毒囊的保守椭球执行首个子弹命中查询。 */
export class VenomLobberProjectileHitSystem {
  public findFirst(
    state: VenomLobberState,
    query: Readonly<PlanarMonsterHitQuery>,
    result: MutablePlanarMonsterHitResult,
  ): boolean {
    validateQuery(query);
    const segmentX = query.endX - query.startX;
    const segmentY = query.endY - query.startY;
    const segmentZ = query.endElevation - query.startElevation;
    const { identity, transform, morphology, vitality } = state.data;
    let bestIndex = -1;
    let bestProgress = Number.POSITIVE_INFINITY;
    for (let index = 0; index < state.count; index++) {
      if ((vitality.state[index] as MonsterLifecycleState) !== MonsterLifecycleState.Alive) {
        continue;
      }
      const scale = morphology.scale[index] ?? 1;
      const centerX = transform.x[index] ?? 0;
      const centerY = transform.y[index] ?? 0;
      const centerZ = 2.55 * scale;
      const horizontalRadius = 3.65 * scale + query.impactRadius;
      const verticalRadius = 2.35 * scale + query.impactRadius;
      const progress = findEllipsoidContact(
        (query.startX - centerX) / horizontalRadius,
        (query.startY - centerY) / horizontalRadius,
        (query.startElevation - centerZ) / verticalRadius,
        segmentX / horizontalRadius,
        segmentY / horizontalRadius,
        segmentZ / verticalRadius,
      );
      if (progress !== null && progress < bestProgress) {
        bestProgress = progress;
        bestIndex = index;
      }
    }
    if (bestIndex < 0) {
      return false;
    }
    result.entityId = identity.id[bestIndex] ?? bestIndex;
    result.x = transform.x[bestIndex] ?? 0;
    result.y = transform.y[bestIndex] ?? 0;
    result.elevation = 2.55 * (morphology.scale[bestIndex] ?? 1);
    result.segmentProgress = bestProgress;
    return true;
  }
}

function findEllipsoidContact(
  startX: number,
  startY: number,
  startZ: number,
  deltaX: number,
  deltaY: number,
  deltaZ: number,
): number | null {
  const a = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
  const b = 2 * (startX * deltaX + startY * deltaY + startZ * deltaZ);
  const c = startX * startX + startY * startY + startZ * startZ - 1;
  const discriminant = b * b - 4 * a * c;
  if (a <= SEGMENT_EPSILON || discriminant < 0) {
    return null;
  }
  const squareRoot = Math.sqrt(discriminant);
  const near = (-b - squareRoot) / (2 * a);
  const far = (-b + squareRoot) / (2 * a);
  if (near >= 0 && near <= 1) {
    return near;
  }
  return far >= 0 && far <= 1 ? far : null;
}

function validateQuery(query: Readonly<PlanarMonsterHitQuery>): void {
  if (!Number.isFinite(query.startX)
    || !Number.isFinite(query.startY)
    || !Number.isFinite(query.startElevation)
    || !Number.isFinite(query.endX)
    || !Number.isFinite(query.endY)
    || !Number.isFinite(query.endElevation)
    || !Number.isFinite(query.impactRadius)
    || query.impactRadius < 0) {
    throw new Error('Venom Lobber 子弹命中查询参数无效。');
  }
  const deltaX = query.endX - query.startX;
  const deltaY = query.endY - query.startY;
  const deltaZ = query.endElevation - query.startElevation;
  if (deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ <= SEGMENT_EPSILON) {
    throw new Error('Venom Lobber 子弹命中线段不能退化。');
  }
}
