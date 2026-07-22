import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import {
  type MutablePlanarMonsterHitResult,
  type PlanarMonsterHitQuery,
} from '../../../../../core/contracts/monster-hit';
import {
  findSweptSphereBoxContact,
  findSweptSphereCapsuleContact,
} from '../../../../../core/geometry/swept-volume-collision';
import { type VenomLobberState } from '../model/venom-lobber-state';

const SEGMENT_EPSILON = 0.000001;

/** 使用前甲壳、腹部与双毒囊复合体执行实体弹丸连续碰撞。 */
export class VenomLobberProjectileHitSystem {
  private readonly candidate: MutablePlanarMonsterHitResult = {
    entityId: -1,
    x: 0,
    y: 0,
    elevation: 0,
    segmentProgress: 0,
  };

  public findFirst(
    state: VenomLobberState,
    query: Readonly<PlanarMonsterHitQuery>,
    result: MutablePlanarMonsterHitResult,
  ): boolean {
    validateQuery(query);
    let found = false;
    let bestProgress = Number.POSITIVE_INFINITY;
    for (let index = 0; index < state.count; index++) {
      if (!this.findEntity(state, index, query, this.candidate)
        || this.candidate.segmentProgress >= bestProgress) {
        continue;
      }
      copyHit(this.candidate, result);
      bestProgress = this.candidate.segmentProgress;
      found = true;
    }
    return found;
  }

  /** 对单一 Venom Lobber 求移动目标相对空间中的最早 TOI。 */
  public findEntity(
    state: VenomLobberState,
    entityIndex: number,
    query: Readonly<PlanarMonsterHitQuery>,
    result: MutablePlanarMonsterHitResult,
  ): boolean {
    validateQuery(query);
    if (!Number.isSafeInteger(entityIndex) || entityIndex < 0 || entityIndex >= state.count) {
      throw new Error('Venom Lobber 命中实体索引越界。');
    }
    const { identity, transform, morphology, vitality } = state.data;
    if ((vitality.state[entityIndex] as MonsterLifecycleState)
      !== MonsterLifecycleState.Alive) {
      return false;
    }
    const previousX = transform.previousX[entityIndex] ?? transform.x[entityIndex] ?? 0;
    const previousY = transform.previousY[entityIndex] ?? transform.y[entityIndex] ?? 0;
    const currentX = transform.x[entityIndex] ?? 0;
    const currentY = transform.y[entityIndex] ?? 0;
    const heading = transform.heading[entityIndex] ?? 0;
    const headingCosine = Math.cos(heading);
    const headingSine = Math.sin(heading);
    const scale = morphology.scale[entityIndex] ?? 1;
    const startRelativeX = (query.startX - previousX) / scale;
    const startRelativeY = (query.startY - previousY) / scale;
    const endRelativeX = (query.endX - currentX) / scale;
    const endRelativeY = (query.endY - currentY) / scale;
    const startForward = startRelativeX * headingCosine + startRelativeY * headingSine;
    const startLateral = -startRelativeX * headingSine + startRelativeY * headingCosine;
    const endForward = endRelativeX * headingCosine + endRelativeY * headingSine;
    const endLateral = -endRelativeX * headingSine + endRelativeY * headingCosine;
    const startElevation = query.startElevation / scale;
    const endElevation = query.endElevation / scale;
    const radius = query.impactRadius / scale;
    let progress = findSweptSphereBoxContact(
      startForward - 2.15, startLateral, startElevation - 2.25,
      endForward - 2.15, endLateral, endElevation - 2.25,
      2.75, 1.72, 1.48, radius,
    );
    progress = minimumContact(progress, findSweptSphereBoxContact(
      startForward + 0.75, startLateral, startElevation - 2.35,
      endForward + 0.75, endLateral, endElevation - 2.35,
      2.65, 2.05, 1.62, radius,
    ));
    progress = minimumContact(progress, findSweptSphereCapsuleContact(
      startForward, startLateral, startElevation,
      endForward, endLateral, endElevation,
      -3.78, -0.75, 3.85,
      -3.72, 0.82, 3.92,
      0.82 + radius,
    ));
    if (progress === null) {
      return false;
    }
    result.entityId = identity.id[entityIndex] ?? entityIndex;
    result.x = currentX;
    result.y = currentY;
    result.elevation = 2.55 * scale;
    result.segmentProgress = progress;
    return true;
  }
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
    throw new Error('Venom Lobber 实体弹丸查询参数无效。');
  }
  const deltaX = query.endX - query.startX;
  const deltaY = query.endY - query.startY;
  const deltaZ = query.endElevation - query.startElevation;
  if (deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ <= SEGMENT_EPSILON) {
    throw new Error('Venom Lobber 实体弹丸查询不能使用退化线段。');
  }
}

function minimumContact(first: number | null, second: number | null): number | null {
  if (first === null) {
    return second;
  }
  return second === null ? first : Math.min(first, second);
}

function copyHit(
  source: Readonly<MutablePlanarMonsterHitResult>,
  target: MutablePlanarMonsterHitResult,
): void {
  target.entityId = source.entityId;
  target.x = source.x;
  target.y = source.y;
  target.elevation = source.elevation;
  target.segmentProgress = source.segmentProgress;
}
