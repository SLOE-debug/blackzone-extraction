import {
  type MutablePlanarMonsterHitResult,
  type PlanarMonsterHitQuery,
} from '../../../../../core/contracts/monster-hit';
import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import {
  calculateCurveCrawlerAimElevation,
  calculateCurveCrawlerForwardHitHalfExtent,
  calculateCurveCrawlerLateralHitHalfExtent,
  calculateCurveCrawlerVerticalHitHalfExtent,
} from '../model/curve-crawler-combat-volume';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

const SEGMENT_EPSILON = 0.000001;

/** 使用覆盖完整身体与远端腿部的单一旋转盒执行无分配线段命中查询。 */
export class CurveCrawlerProjectileHitSystem {
  /** 选择从线段起点出发最先接触的存活实体。 */
  public findFirst(
    state: CurveCrawlerState,
    query: Readonly<PlanarMonsterHitQuery>,
    result: MutablePlanarMonsterHitResult,
  ): boolean {
    validateQuery(query);
    const segmentX = query.endX - query.startX;
    const segmentY = query.endY - query.startY;
    const segmentElevation = query.endElevation - query.startElevation;
    const { identity, transform, morphology, vitality, animation } = state.data;
    let bestIndex = -1;
    let bestProgress = Number.POSITIVE_INFINITY;

    for (let index = 0; index < state.count; index++) {
      if ((vitality.state[index] as MonsterLifecycleState) !== MonsterLifecycleState.Alive) {
        continue;
      }
      const centerX = transform.x[index] ?? 0;
      const centerY = transform.y[index] ?? 0;
      const headingCosine = transform.headingCosine[index] ?? 1;
      const headingSine = transform.headingSine[index] ?? 0;
      const bodyLength = morphology.bodyLength[index] ?? 0;
      const bodyWidth = morphology.bodyWidth[index] ?? 0;
      const legLength = morphology.legLength[index] ?? 0;
      const legWidth = morphology.legWidth[index] ?? 0;
      const bodyPulse = animation.bodyPulse[index] ?? 0;
      const crouchAmount = animation.crouchAmount[index] ?? 0;
      const biteAmount = animation.biteAmount[index] ?? 0;
      const turnAmount = animation.turnAmount[index] ?? 0;
      const centerElevation = calculateCurveCrawlerAimElevation(
        bodyWidth,
        bodyPulse,
        crouchAmount,
        biteAmount,
      );
      const forwardHalfExtent = Math.max(
        calculateCurveCrawlerForwardHitHalfExtent(
          bodyLength,
          legLength,
          legWidth,
          bodyPulse,
          crouchAmount,
          biteAmount,
          turnAmount,
        ) + query.impactRadius,
        SEGMENT_EPSILON,
      );
      const lateralHalfExtent = Math.max(
        calculateCurveCrawlerLateralHitHalfExtent(
          bodyWidth,
          legLength,
          legWidth,
          bodyPulse,
          crouchAmount,
          biteAmount,
        ) + query.impactRadius,
        SEGMENT_EPSILON,
      );
      const verticalHalfExtent = Math.max(
        calculateCurveCrawlerVerticalHitHalfExtent(
          bodyWidth,
          legLength,
          legWidth,
          bodyPulse,
          crouchAmount,
          biteAmount,
          turnAmount,
        ) + query.impactRadius,
        SEGMENT_EPSILON,
      );
      const relativeStartX = query.startX - centerX;
      const relativeStartY = query.startY - centerY;
      const startForward = relativeStartX * headingCosine
        + relativeStartY * headingSine;
      const startLateral = -relativeStartX * headingSine
        + relativeStartY * headingCosine;
      const deltaForward = segmentX * headingCosine + segmentY * headingSine;
      const deltaLateral = -segmentX * headingSine + segmentY * headingCosine;
      const contactProgress = findFirstOrientedBoxContact(
        startForward,
        startLateral,
        query.startElevation - centerElevation,
        deltaForward,
        deltaLateral,
        segmentElevation,
        forwardHalfExtent,
        lateralHalfExtent,
        verticalHalfExtent,
      );
      if (contactProgress !== null && contactProgress < bestProgress) {
        bestIndex = index;
        bestProgress = contactProgress;
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
    result.segmentProgress = bestProgress;
    return true;
  }

  /** 对共享空间索引给出的单一实体执行精确旋转盒检测。 */
  public findEntity(
    state: CurveCrawlerState,
    entityIndex: number,
    query: Readonly<PlanarMonsterHitQuery>,
    result: MutablePlanarMonsterHitResult,
  ): boolean {
    validateQuery(query);
    if (!Number.isSafeInteger(entityIndex)
      || entityIndex < 0
      || entityIndex >= state.count) {
      throw new Error('Curve Crawler 命中实体索引越界。');
    }
    const { identity, transform, morphology, vitality, animation } = state.data;
    if ((vitality.state[entityIndex] as MonsterLifecycleState)
      !== MonsterLifecycleState.Alive) {
      return false;
    }
    const segmentX = query.endX - query.startX;
    const segmentY = query.endY - query.startY;
    const segmentElevation = query.endElevation - query.startElevation;
    const centerX = transform.x[entityIndex] ?? 0;
    const centerY = transform.y[entityIndex] ?? 0;
    const headingCosine = transform.headingCosine[entityIndex] ?? 1;
    const headingSine = transform.headingSine[entityIndex] ?? 0;
    const bodyLength = morphology.bodyLength[entityIndex] ?? 0;
    const bodyWidth = morphology.bodyWidth[entityIndex] ?? 0;
    const legLength = morphology.legLength[entityIndex] ?? 0;
    const legWidth = morphology.legWidth[entityIndex] ?? 0;
    const bodyPulse = animation.bodyPulse[entityIndex] ?? 0;
    const crouchAmount = animation.crouchAmount[entityIndex] ?? 0;
    const biteAmount = animation.biteAmount[entityIndex] ?? 0;
    const turnAmount = animation.turnAmount[entityIndex] ?? 0;
    const centerElevation = calculateCurveCrawlerAimElevation(
      bodyWidth, bodyPulse, crouchAmount, biteAmount,
    );
    const relativeStartX = query.startX - centerX;
    const relativeStartY = query.startY - centerY;
    const progress = findFirstOrientedBoxContact(
      relativeStartX * headingCosine + relativeStartY * headingSine,
      -relativeStartX * headingSine + relativeStartY * headingCosine,
      query.startElevation - centerElevation,
      segmentX * headingCosine + segmentY * headingSine,
      -segmentX * headingSine + segmentY * headingCosine,
      segmentElevation,
      Math.max(calculateCurveCrawlerForwardHitHalfExtent(
        bodyLength, legLength, legWidth, bodyPulse, crouchAmount, biteAmount, turnAmount,
      ) + query.impactRadius, SEGMENT_EPSILON),
      Math.max(calculateCurveCrawlerLateralHitHalfExtent(
        bodyWidth, legLength, legWidth, bodyPulse, crouchAmount, biteAmount,
      ) + query.impactRadius, SEGMENT_EPSILON),
      Math.max(calculateCurveCrawlerVerticalHitHalfExtent(
        bodyWidth, legLength, legWidth, bodyPulse, crouchAmount, biteAmount, turnAmount,
      ) + query.impactRadius, SEGMENT_EPSILON),
    );
    if (progress === null) {
      return false;
    }
    result.entityId = identity.id[entityIndex] ?? entityIndex;
    result.x = centerX;
    result.y = centerY;
    result.elevation = centerElevation;
    result.segmentProgress = progress;
    return true;
  }
}

/** 拒绝退化线段和负命中半径，避免投影计算产生无效数值。 */
function validateQuery(query: Readonly<PlanarMonsterHitQuery>): void {
  if (!Number.isFinite(query.startX)
    || !Number.isFinite(query.startY)
    || !Number.isFinite(query.startElevation)
    || !Number.isFinite(query.endX)
    || !Number.isFinite(query.endY)
    || !Number.isFinite(query.endElevation)
    || !Number.isFinite(query.impactRadius)
    || query.impactRadius < 0) {
    throw new Error('Curve Crawler 子弹命中查询必须使用有限坐标和非负半径。');
  }
  const segmentX = query.endX - query.startX;
  const segmentY = query.endY - query.startY;
  const segmentElevation = query.endElevation - query.startElevation;
  if (segmentX * segmentX
    + segmentY * segmentY
    + segmentElevation * segmentElevation <= SEGMENT_EPSILON) {
    throw new Error('Curve Crawler 子弹命中查询不能使用退化线段。');
  }
}

/** 返回线段进入旋转盒局部空间的首个参数位置，未接触时返回空。 */
function findFirstOrientedBoxContact(
  startForward: number,
  startLateral: number,
  startElevation: number,
  deltaForward: number,
  deltaLateral: number,
  deltaElevation: number,
  forwardHalfExtent: number,
  lateralHalfExtent: number,
  verticalHalfExtent: number,
): number | null {
  let minimumProgress = 0;
  let maximumProgress = 1;

  if (Math.abs(deltaForward) <= SEGMENT_EPSILON) {
    if (Math.abs(startForward) > forwardHalfExtent) {
      return null;
    }
  } else {
    let near = (-forwardHalfExtent - startForward) / deltaForward;
    let far = (forwardHalfExtent - startForward) / deltaForward;
    if (near > far) {
      const swap = near;
      near = far;
      far = swap;
    }
    minimumProgress = Math.max(minimumProgress, near);
    maximumProgress = Math.min(maximumProgress, far);
    if (minimumProgress > maximumProgress) {
      return null;
    }
  }

  if (Math.abs(deltaLateral) <= SEGMENT_EPSILON) {
    if (Math.abs(startLateral) > lateralHalfExtent) {
      return null;
    }
  } else {
    let near = (-lateralHalfExtent - startLateral) / deltaLateral;
    let far = (lateralHalfExtent - startLateral) / deltaLateral;
    if (near > far) {
      const swap = near;
      near = far;
      far = swap;
    }
    minimumProgress = Math.max(minimumProgress, near);
    maximumProgress = Math.min(maximumProgress, far);
    if (minimumProgress > maximumProgress) {
      return null;
    }
  }

  if (Math.abs(deltaElevation) <= SEGMENT_EPSILON) {
    if (Math.abs(startElevation) > verticalHalfExtent) {
      return null;
    }
  } else {
    let near = (-verticalHalfExtent - startElevation) / deltaElevation;
    let far = (verticalHalfExtent - startElevation) / deltaElevation;
    if (near > far) {
      const swap = near;
      near = far;
      far = swap;
    }
    minimumProgress = Math.max(minimumProgress, near);
    maximumProgress = Math.min(maximumProgress, far);
    if (minimumProgress > maximumProgress) {
      return null;
    }
  }

  return minimumProgress >= 0 && minimumProgress <= 1
    ? minimumProgress
    : null;
}
