import {
  type MutablePlanarTargetResult,
  type PlanarTargetQuery,
} from '../../../../../core/contracts/planar-target';
import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { findSweptSphereBoxContact } from '../../../../../core/geometry/swept-volume-collision';
import {
  calculateCurveCrawlerAimElevation,
  type MutableCurveCrawlerHitExtents,
  writeCurveCrawlerForgivingHitExtents,
} from '../model/curve-crawler-combat-volume';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

const SEGMENT_EPSILON = 0.000001;

/** 使用身体与近端腿部宽容轮廓执行无分配平面射线查询。 */
export class CurveCrawlerTargeting {
  private readonly candidate: MutablePlanarTargetResult = {
    entityId: -1,
    x: 0,
    y: 0,
    elevation: 0,
    segmentProgress: 0,
  };
  private readonly forgivingHitExtents: MutableCurveCrawlerHitExtents = {
    forward: 0,
    lateral: 0,
    vertical: 0,
  };

  /** 选择线段从起点最先经过的存活实体。 */
  public findFirst(
    state: CurveCrawlerState,
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

  /** 判断线段是否实际经过单一实体的身体或近端腿部宽容轮廓。 */
  public findEntity(
    state: CurveCrawlerState,
    entityIndex: number,
    query: Readonly<PlanarTargetQuery>,
    result: MutablePlanarTargetResult,
  ): boolean {
    validateQuery(query);
    if (!Number.isSafeInteger(entityIndex) || entityIndex < 0 || entityIndex >= state.count) {
      throw new Error('Curve Crawler 瞄准实体索引越界。');
    }
    const { identity, transform, morphology, vitality, animation } = state.data;
    if ((vitality.state[entityIndex] as MonsterLifecycleState)
      !== MonsterLifecycleState.Alive) {
      return false;
    }
    const centerX = transform.x[entityIndex] ?? 0;
    const centerY = transform.y[entityIndex] ?? 0;
    const headingCosine = transform.headingCosine[entityIndex] ?? 1;
    const headingSine = transform.headingSine[entityIndex] ?? 0;
    const startRelativeX = query.startX - centerX;
    const startRelativeY = query.startY - centerY;
    const endRelativeX = query.endX - centerX;
    const endRelativeY = query.endY - centerY;
    const startForward = startRelativeX * headingCosine + startRelativeY * headingSine;
    const startLateral = -startRelativeX * headingSine + startRelativeY * headingCosine;
    const endForward = endRelativeX * headingCosine + endRelativeY * headingSine;
    const endLateral = -endRelativeX * headingSine + endRelativeY * headingCosine;
    const bodyLength = morphology.bodyLength[entityIndex] ?? 1;
    const bodyWidth = morphology.bodyWidth[entityIndex] ?? 1;
    const legLength = morphology.legLength[entityIndex] ?? 1;
    const legWidth = morphology.legWidth[entityIndex] ?? 0;
    const bodyPulse = animation.bodyPulse[entityIndex] ?? 0;
    const crouchAmount = animation.crouchAmount[entityIndex] ?? 0;
    const biteAmount = animation.biteAmount[entityIndex] ?? 0;
    const turnAmount = animation.turnAmount[entityIndex] ?? 0;
    let progress = findPlanarBoxContact(
      startForward - bodyLength * 0.2,
      startLateral,
      endForward - bodyLength * 0.2,
      endLateral,
      bodyLength * 0.34,
      bodyWidth * 0.46,
    );
    progress = minimumContact(progress, findPlanarBoxContact(
      startForward + bodyLength * 0.25,
      startLateral,
      endForward + bodyLength * 0.25,
      endLateral,
      bodyLength * 0.36,
      bodyWidth * 0.54,
    ));
    writeCurveCrawlerForgivingHitExtents(
      bodyLength,
      bodyWidth,
      legLength,
      legWidth,
      bodyPulse,
      crouchAmount,
      biteAmount,
      turnAmount,
      this.forgivingHitExtents,
    );
    progress = minimumContact(progress, findPlanarBoxContact(
      startForward,
      startLateral,
      endForward,
      endLateral,
      this.forgivingHitExtents.forward,
      this.forgivingHitExtents.lateral,
    ));
    if (progress === null) {
      return false;
    }
    result.entityId = identity.id[entityIndex] ?? entityIndex;
    result.x = centerX;
    result.y = centerY;
    result.elevation = calculateCurveCrawlerAimElevation(
      bodyWidth,
      bodyPulse,
      crouchAmount,
      biteAmount,
    );
    result.segmentProgress = progress;
    return true;
  }
}

/** 在二维平面复用三维盒体扫掠算法，第三轴固定为零。 */
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

function validateQuery(query: Readonly<PlanarTargetQuery>): void {
  if (![query.startX, query.startY, query.endX, query.endY].every(Number.isFinite)) {
    throw new Error('Curve Crawler 目标线段必须使用有限坐标。');
  }
  if (Math.hypot(query.endX - query.startX, query.endY - query.startY)
    <= SEGMENT_EPSILON) {
    throw new Error('Curve Crawler 目标线段不能退化。');
  }
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
