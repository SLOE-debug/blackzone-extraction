import { type VertexStreams } from '../../../../../core/mesh/vertex-streams';
import {
  CURVE_CRAWLER_FRAGMENT_COUNT,
  CurveCrawlerFragmentIndex,
} from '../model/curve-crawler-schema';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { type CurveCrawlerMeshPlan } from './curve-crawler-mesh-plan';
import { evaluateEllipsoid } from './kernels/ellipsoid-kernel';

/**
 * 直接求值一只未完全坍缩的 Curve Crawler 双眼。
 *
 * @param state 当前群体 SoA 状态。
 * @param plan 编译后的单实体局部计划。
 * @param entityIndex 当前实体在领域状态中的索引。
 * @param entityVertexOffset 当前实体在批次顶点流中的首顶点偏移。
 * @param fragmentScale 死亡爆裂阶段的碎块缩放比例。
 * @param streams 当前批次可写顶点流。
 * @param writePositions 是否允许改写位置流。
 * @param writeNormals 是否允许改写法线流。
 */
export function evaluateCurveCrawlerEyeMesh(
  state: CurveCrawlerState,
  plan: CurveCrawlerMeshPlan,
  entityIndex: number,
  entityVertexOffset: number,
  fragmentScale: number,
  streams: VertexStreams,
  writePositions: boolean,
  writeNormals: boolean,
): void {
  const { transform, morphology, animation } = state.data;
  const originX = transform.x[entityIndex] ?? 0;
  const originY = transform.y[entityIndex] ?? 0;
  const heading = transform.heading[entityIndex] ?? 0;
  const headingCosine = Math.cos(heading);
  const headingSine = Math.sin(heading);
  const bodyLength = morphology.bodyLength[entityIndex] ?? 0;
  const bodyWidth = morphology.bodyWidth[entityIndex] ?? 0;
  const biteAmount = animation.biteAmount[entityIndex] ?? 0;
  const forward = bodyLength * (0.48 + biteAmount * 0.16);
  const sideOffset = bodyWidth * 0.17;
  const radiusX = Math.max((morphology.eyeRadius[entityIndex] ?? 0) * fragmentScale, 0.0001);
  const radiusY = radiusX * 0.92;
  const radiusZ = radiusX * Math.max(animation.blinkScale[entityIndex] ?? 1, 0.08);
  const crouchAmount = animation.crouchAmount[entityIndex] ?? 0;
  const eyeCenterZ = bodyWidth * 0.36 * (1.8 - crouchAmount * 0.2 - biteAmount * 0.12);
  const fragmentOffset = entityIndex * CURVE_CRAWLER_FRAGMENT_COUNT;

  evaluateEye(
    CurveCrawlerFragmentIndex.LeftEye,
    -1,
    plan.eyes.leftVertexOffset,
    state,
    plan,
    streams,
    entityVertexOffset,
    originX,
    originY,
    heading,
    headingCosine,
    headingSine,
    forward,
    sideOffset,
    eyeCenterZ,
    radiusX,
    radiusY,
    radiusZ,
    fragmentOffset,
    writePositions,
    writeNormals,
  );
  evaluateEye(
    CurveCrawlerFragmentIndex.RightEye,
    1,
    plan.eyes.rightVertexOffset,
    state,
    plan,
    streams,
    entityVertexOffset,
    originX,
    originY,
    heading,
    headingCosine,
    headingSine,
    forward,
    sideOffset,
    eyeCenterZ,
    radiusX,
    radiusY,
    radiusZ,
    fragmentOffset,
    writePositions,
    writeNormals,
  );
}

/** 将单颗眼睛的当前碎块变换求值为椭球顶点流。 */
function evaluateEye(
  fragmentKind: CurveCrawlerFragmentIndex,
  side: number,
  localVertexOffset: number,
  state: CurveCrawlerState,
  plan: CurveCrawlerMeshPlan,
  streams: VertexStreams,
  entityVertexOffset: number,
  originX: number,
  originY: number,
  heading: number,
  headingCosine: number,
  headingSine: number,
  forward: number,
  sideOffset: number,
  eyeCenterZ: number,
  radiusX: number,
  radiusY: number,
  radiusZ: number,
  fragmentOffset: number,
  writePositions: boolean,
  writeNormals: boolean,
): void {
  const fragmentIndex = fragmentOffset + fragmentKind;
  const { animation } = state.data;
  const localY = side * sideOffset;
  evaluateEllipsoid(
    plan.eyeEllipsoid,
    streams,
    entityVertexOffset + localVertexOffset,
    originX + forward * headingCosine - localY * headingSine
      + (animation.fragmentOffsetX[fragmentIndex] ?? 0),
    originY + forward * headingSine + localY * headingCosine
      + (animation.fragmentOffsetY[fragmentIndex] ?? 0),
    eyeCenterZ + (animation.fragmentOffsetZ[fragmentIndex] ?? 0),
    radiusX,
    radiusY,
    radiusZ,
    heading + (animation.fragmentRotation[fragmentIndex] ?? 0),
    writePositions,
    writeNormals,
  );
}
