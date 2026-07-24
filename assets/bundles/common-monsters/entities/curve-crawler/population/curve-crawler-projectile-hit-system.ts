import {
  type MutablePlanarMonsterHitResult,
  type PlanarMonsterHitQuery,
} from '../../../../../core/contracts/monster-hit';
import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { MonsterManipulationState } from '../../../../../core/contracts/monster-manipulation';
import { findSweptSphereBoxContact } from '../../../../../core/geometry/swept-volume-collision';
import {
  calculateCurveCrawlerAimElevation,
  type MutableCurveCrawlerHitExtents,
  writeCurveCrawlerForgivingHitExtents,
} from '../model/curve-crawler-combat-volume';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

const SEGMENT_EPSILON = 0.000001;

/** 使用胸腔、腹部与近端腿部宽容 OBB 执行实体弹丸连续碰撞。 */
export class CurveCrawlerProjectileHitSystem {
  private readonly candidate: MutablePlanarMonsterHitResult = {
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

  /** 选择整个人口中从线段起点最先接触的存活实体。 */
  public findFirst(
    state: CurveCrawlerState,
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

  /** 对共享宽相位给出的单一实体求本帧最早 TOI。 */
  public findEntity(
    state: CurveCrawlerState,
    entityIndex: number,
    query: Readonly<PlanarMonsterHitQuery>,
    result: MutablePlanarMonsterHitResult,
  ): boolean {
    validateQuery(query);
    if (!Number.isSafeInteger(entityIndex) || entityIndex < 0 || entityIndex >= state.count) {
      throw new Error('Curve Crawler 命中实体索引越界。');
    }
    const { identity, transform, morphology, vitality, manipulation, animation } = state.data;
    if ((vitality.state[entityIndex] as MonsterLifecycleState)
      !== MonsterLifecycleState.Alive) {
      return false;
    }
    if ((manipulation.state[entityIndex] as MonsterManipulationState)
      !== MonsterManipulationState.Free) {
      return false;
    }
    const headingCosine = transform.headingCosine[entityIndex] ?? 1;
    const headingSine = transform.headingSine[entityIndex] ?? 0;
    const previousX = transform.previousX[entityIndex] ?? transform.x[entityIndex] ?? 0;
    const previousY = transform.previousY[entityIndex] ?? transform.y[entityIndex] ?? 0;
    const currentX = transform.x[entityIndex] ?? 0;
    const currentY = transform.y[entityIndex] ?? 0;
    const startRelativeX = query.startX - previousX;
    const startRelativeY = query.startY - previousY;
    const endRelativeX = query.endX - currentX;
    const endRelativeY = query.endY - currentY;
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
    const centerElevation = calculateCurveCrawlerAimElevation(
      bodyWidth,
      bodyPulse,
      crouchAmount,
      biteAmount,
    );
    const startElevation = query.startElevation - centerElevation;
    const endElevation = query.endElevation - centerElevation;
    const thoraxContact = findSweptSphereBoxContact(
      startForward - bodyLength * 0.2,
      startLateral,
      startElevation,
      endForward - bodyLength * 0.2,
      endLateral,
      endElevation,
      bodyLength * 0.34,
      bodyWidth * 0.46,
      bodyWidth * 0.42,
      query.impactRadius,
    );
    const abdomenContact = findSweptSphereBoxContact(
      startForward + bodyLength * 0.25,
      startLateral,
      startElevation + bodyWidth * 0.04,
      endForward + bodyLength * 0.25,
      endLateral,
      endElevation + bodyWidth * 0.04,
      bodyLength * 0.36,
      bodyWidth * 0.54,
      bodyWidth * 0.47,
      query.impactRadius,
    );
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
    const forgivingFootprintContact = findSweptSphereBoxContact(
      startForward,
      startLateral,
      startElevation,
      endForward,
      endLateral,
      endElevation,
      this.forgivingHitExtents.forward,
      this.forgivingHitExtents.lateral,
      this.forgivingHitExtents.vertical,
      query.impactRadius,
    );
    const bodyContact = minimumContact(thoraxContact, abdomenContact);
    const progress = minimumContact(bodyContact, forgivingFootprintContact);
    if (progress === null) {
      return false;
    }
    result.entityId = identity.id[entityIndex] ?? entityIndex;
    result.x = currentX;
    result.y = currentY;
    result.elevation = centerElevation;
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
    throw new Error('Curve Crawler 实体弹丸查询必须使用有限坐标和非负半径。');
  }
  const deltaX = query.endX - query.startX;
  const deltaY = query.endY - query.startY;
  const deltaZ = query.endElevation - query.startElevation;
  if (deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ <= SEGMENT_EPSILON) {
    throw new Error('Curve Crawler 实体弹丸查询不能使用退化线段。');
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
