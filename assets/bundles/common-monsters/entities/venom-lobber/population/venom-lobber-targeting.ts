import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import {
  type MutablePlanarTargetResult,
  type PlanarTargetQuery,
} from '../../../../../core/contracts/planar-target';
import {
  findSweptSphereBoxContact,
  findSweptSphereCapsuleContact,
} from '../../../../../core/geometry/swept-volume-collision';
import { type VenomLobberState } from '../model/venom-lobber-state';

const SEGMENT_EPSILON = 0.000001;

/** 使用可见身体复合轮廓执行 Venom Lobber 平面射线查询。 */
export class VenomLobberTargeting {
  private readonly candidate: MutablePlanarTargetResult = {
    entityId: -1,
    x: 0,
    y: 0,
    elevation: 0,
    segmentProgress: 0,
  };

  public findFirst(
    state: VenomLobberState,
    query: Readonly<PlanarTargetQuery>,
    result: MutablePlanarTargetResult,
  ): boolean {
    validateQuery(query);
    let found = false;
    let bestProgress = Number.POSITIVE_INFINITY;
    for (let index = 0; index < state.count; index++) {
      if (!this.findEntity(state, index, query, this.candidate)
        || this.candidate.segmentProgress >= bestProgress) {
        continue;
      }
      copyTarget(this.candidate, result);
      bestProgress = this.candidate.segmentProgress;
      found = true;
    }
    return found;
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
    const centerX = transform.x[entityIndex] ?? 0;
    const centerY = transform.y[entityIndex] ?? 0;
    const heading = transform.heading[entityIndex] ?? 0;
    const headingCosine = Math.cos(heading);
    const headingSine = Math.sin(heading);
    const scale = morphology.scale[entityIndex] ?? 1;
    const startRelativeX = (query.startX - centerX) / scale;
    const startRelativeY = (query.startY - centerY) / scale;
    const endRelativeX = (query.endX - centerX) / scale;
    const endRelativeY = (query.endY - centerY) / scale;
    const startForward = startRelativeX * headingCosine + startRelativeY * headingSine;
    const startLateral = -startRelativeX * headingSine + startRelativeY * headingCosine;
    const endForward = endRelativeX * headingCosine + endRelativeY * headingSine;
    const endLateral = -endRelativeX * headingSine + endRelativeY * headingCosine;
    let progress = findPlanarBoxContact(
      startForward - 2.15, startLateral,
      endForward - 2.15, endLateral,
      2.75, 1.72,
    );
    progress = minimumContact(progress, findPlanarBoxContact(
      startForward + 0.75, startLateral,
      endForward + 0.75, endLateral,
      2.65, 2.05,
    ));
    progress = minimumContact(progress, findSweptSphereCapsuleContact(
      startForward, startLateral, 0,
      endForward, endLateral, 0,
      -3.78, -0.75, 0,
      -3.72, 0.82, 0,
      0.82,
    ));
    if (progress === null) {
      return false;
    }
    result.entityId = identity.id[entityIndex] ?? entityIndex;
    result.x = centerX;
    result.y = centerY;
    result.elevation = 2.55 * scale;
    result.segmentProgress = progress;
    return true;
  }
}

function validateQuery(query: Readonly<PlanarTargetQuery>): void {
  if (![query.startX, query.startY, query.endX, query.endY].every(Number.isFinite)
    || Math.hypot(query.endX - query.startX, query.endY - query.startY)
      <= SEGMENT_EPSILON) {
    throw new Error('Venom Lobber 目标线段参数无效。');
  }
}

function findPlanarBoxContact(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  halfExtentX: number,
  halfExtentY: number,
): number | null {
  return findSweptSphereBoxContact(
    startX, startY, 0,
    endX, endY, 0,
    halfExtentX, halfExtentY, 0,
    0,
  );
}

function minimumContact(first: number | null, second: number | null): number | null {
  if (first === null) {
    return second;
  }
  return second === null ? first : Math.min(first, second);
}

function copyTarget(
  source: Readonly<MutablePlanarTargetResult>,
  target: MutablePlanarTargetResult,
): void {
  target.entityId = source.entityId;
  target.x = source.x;
  target.y = source.y;
  target.elevation = source.elevation;
  target.segmentProgress = source.segmentProgress;
}
