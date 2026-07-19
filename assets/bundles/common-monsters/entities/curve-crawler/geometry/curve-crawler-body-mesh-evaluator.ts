import { type VertexStreams } from '../../../../../core/mesh/vertex-streams';
import {
  CURVE_CRAWLER_FRAGMENT_COUNT,
  CURVE_CRAWLER_LEG_COUNT,
  CurveCrawlerFragmentIndex,
} from '../model/curve-crawler-schema';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { type CurveCrawlerMeshPlan } from './curve-crawler-mesh-plan';
import {
  evaluateCubicTube,
  type MutableCubicTubeControlPoints,
} from './kernels/cubic-tube-kernel';
import { evaluateEllipsoid } from './kernels/ellipsoid-kernel';

const LEG_FORWARD_FANS = new Float32Array([0.72, 0.25, -0.25, -0.72]);

/**
 * 单条腿在当前帧复用的控制点缓存。
 *
 * 除管体控制数据外，它还保存脚端椭球所需的半径和旋转，避免每条腿分配对象。
 */
export interface MutableCurveCrawlerLegScratch extends MutableCubicTubeControlPoints {
  footRadius: number;
  footRotation: number;
}

/** 创建一个仅由 MeshEvaluator 在初始化时分配一次的腿部缓存。 */
export function createCurveCrawlerLegScratch(): MutableCurveCrawlerLegScratch {
  return {
    p0x: 0,
    p0y: 0,
    p0z: 0,
    p1x: 0,
    p1y: 0,
    p1z: 0,
    p2x: 0,
    p2y: 0,
    p2z: 0,
    p3x: 0,
    p3y: 0,
    p3z: 0,
    startRadius: 0,
    endRadius: 0,
    footRadius: 0,
    footRotation: 0,
  };
}

/**
 * 直接求值一只未完全坍缩的 Curve Crawler 的八条腿、脚端、腹部和胸部。
 *
 * @param state 当前群体 SoA 状态。
 * @param plan 编译后的单实体局部计划。
 * @param entityIndex 当前实体在领域状态中的索引。
 * @param entityVertexOffset 当前实体在批次顶点流中的首顶点偏移。
 * @param fragmentScale 死亡爆裂阶段的碎块缩放比例。
 * @param streams 当前批次可写顶点流。
 * @param writePositions 是否允许改写位置流。
 * @param writeNormals 是否允许改写法线流。
 * @param legScratch 由调用方长期复用的腿部控制点缓存。
 */
export function evaluateCurveCrawlerBodyMesh(
  state: CurveCrawlerState,
  plan: CurveCrawlerMeshPlan,
  entityIndex: number,
  entityVertexOffset: number,
  fragmentScale: number,
  streams: VertexStreams,
  writePositions: boolean,
  writeNormals: boolean,
  legScratch: MutableCurveCrawlerLegScratch,
): void {
  const { transform, morphology, animation } = state.data;
  const originX = transform.x[entityIndex] ?? 0;
  const originY = transform.y[entityIndex] ?? 0;
  const heading = transform.heading[entityIndex] ?? 0;
  const headingCosine = Math.cos(heading);
  const headingSine = Math.sin(heading);
  const bodyPulse = animation.bodyPulse[entityIndex] ?? 0;
  const crouchAmount = animation.crouchAmount[entityIndex] ?? 0;
  const originalBodyLength = morphology.bodyLength[entityIndex] ?? 0;
  const originalBodyWidth = morphology.bodyWidth[entityIndex] ?? 0;
  const bodyLength = originalBodyLength * (1 + bodyPulse);
  const bodyWidth = originalBodyWidth * (1 - bodyPulse * 0.35 - crouchAmount * 0.08);
  const legLength = (morphology.legLength[entityIndex] ?? 0) * (1 + crouchAmount * 0.08);
  const legWidth = morphology.legWidth[entityIndex] ?? 0;
  const fragmentOffset = entityIndex * CURVE_CRAWLER_FRAGMENT_COUNT;
  const phase = animation.phase[entityIndex] ?? 0;
  const turnAmount = animation.turnAmount[entityIndex] ?? 0;
  const turnDirection = animation.turnDirection[entityIndex] ?? 1;
  const biteAmount = animation.biteAmount[entityIndex] ?? 0;
  const legPhaseOffset = entityIndex * CURVE_CRAWLER_LEG_COUNT;

  for (let leg = 0; leg < CURVE_CRAWLER_LEG_COUNT; leg++) {
    const side = leg < CURVE_CRAWLER_LEG_COUNT * 0.5 ? 1 : -1;
    const pair = leg % (CURVE_CRAWLER_LEG_COUNT * 0.5);
    const rootAlongBody = bodyLength * (0.42 - pair * 0.28);
    const forwardFan = (LEG_FORWARD_FANS[pair] ?? 0) * legLength;
    const gaitAngle = phase + (animation.legPhaseOffsets[legPhaseOffset + leg] ?? 0);
    const swing = Math.sin(gaitAngle);
    const baseLift = Math.max(0, Math.cos(gaitAngle));
    const innerSupportLeg = side === turnDirection;
    const turnStrideScale = innerSupportLeg ? 0.36 : 1.28;
    const turnLiftScale = innerSupportLeg ? 0.32 : 1.12;
    const lift = baseLift * (1 + (turnLiftScale - 1) * turnAmount);
    const stride = swing * legLength * 0.18 * (1 + (turnStrideScale - 1) * turnAmount);
    const outwardScale = 1 - lift * 0.13 + crouchAmount * 0.12;
    const p0x = rootAlongBody;
    const p0y = side * bodyWidth * 0.37;
    const p0z = bodyWidth * (0.28 - crouchAmount * 0.05);
    let p1x = rootAlongBody + forwardFan * 0.24 - stride * 0.08;
    let p1y = side * (bodyWidth * 0.48 + legLength * 0.28);
    let p1z = p0z + legLength * 0.13;
    let p2x = rootAlongBody + forwardFan * 0.67 + stride * 0.28;
    let p2y = side * (bodyWidth * 0.42 + legLength * (0.62 - lift * 0.09));
    let p2z = 0;
    let p3x = rootAlongBody + forwardFan + stride;
    let p3y = side * (bodyWidth * 0.4 + legLength * 0.78 * outwardScale);
    let p3z = 0;
    const startRadius = Math.max(legWidth * 0.5 * fragmentScale, 0.0001);
    const endRadius = Math.max(legWidth * 0.29 * fragmentScale, 0.0001);
    const footRadius = endRadius * 1.2;
    const gaitLift = lift * legLength * 0.11;
    p2z = footRadius + legLength * 0.08 + gaitLift * 0.55;
    p3z = footRadius + gaitLift;

    if (pair <= 1 && biteAmount > 0.001) {
      // 啃咬时前腿保持贴地并向前撑开，避免重新形成无意义的抬手姿态。
      p2x += legLength * 0.055 * biteAmount;
      p3x += legLength * 0.11 * biteAmount;
      p3y += side * legLength * 0.035 * biteAmount;
    }

    const fragmentIndex = fragmentOffset + leg;
    const fragmentRotation = animation.fragmentRotation[fragmentIndex] ?? 0;
    if (fragmentRotation !== 0 || fragmentScale < 0.9999) {
      const rotationCosine = Math.cos(fragmentRotation);
      const rotationSine = Math.sin(fragmentRotation);
      const relativeP1x = p1x - p0x;
      const relativeP1y = p1y - p0y;
      p1x = p0x + (relativeP1x * rotationCosine - relativeP1y * rotationSine) * fragmentScale;
      p1y = p0y + (relativeP1x * rotationSine + relativeP1y * rotationCosine) * fragmentScale;
      const relativeP2x = p2x - p0x;
      const relativeP2y = p2y - p0y;
      p2x = p0x + (relativeP2x * rotationCosine - relativeP2y * rotationSine) * fragmentScale;
      p2y = p0y + (relativeP2x * rotationSine + relativeP2y * rotationCosine) * fragmentScale;
      const relativeP3x = p3x - p0x;
      const relativeP3y = p3y - p0y;
      p3x = p0x + (relativeP3x * rotationCosine - relativeP3y * rotationSine) * fragmentScale;
      p3y = p0y + (relativeP3x * rotationSine + relativeP3y * rotationCosine) * fragmentScale;
      p1z = p0z + (p1z - p0z) * fragmentScale;
      p2z = p0z + (p2z - p0z) * fragmentScale;
      p3z = p0z + (p3z - p0z) * fragmentScale;
    }

    const fragmentOffsetX = animation.fragmentOffsetX[fragmentIndex] ?? 0;
    const fragmentOffsetY = animation.fragmentOffsetY[fragmentIndex] ?? 0;
    const fragmentOffsetZ = animation.fragmentOffsetZ[fragmentIndex] ?? 0;
    legScratch.p0x = originX + p0x * headingCosine - p0y * headingSine + fragmentOffsetX;
    legScratch.p0y = originY + p0x * headingSine + p0y * headingCosine + fragmentOffsetY;
    legScratch.p0z = p0z + fragmentOffsetZ;
    legScratch.p1x = originX + p1x * headingCosine - p1y * headingSine + fragmentOffsetX;
    legScratch.p1y = originY + p1x * headingSine + p1y * headingCosine + fragmentOffsetY;
    legScratch.p1z = p1z + fragmentOffsetZ;
    legScratch.p2x = originX + p2x * headingCosine - p2y * headingSine + fragmentOffsetX;
    legScratch.p2y = originY + p2x * headingSine + p2y * headingCosine + fragmentOffsetY;
    legScratch.p2z = p2z + fragmentOffsetZ;
    legScratch.p3x = originX + p3x * headingCosine - p3y * headingSine + fragmentOffsetX;
    legScratch.p3y = originY + p3x * headingSine + p3y * headingCosine + fragmentOffsetY;
    legScratch.p3z = p3z + fragmentOffsetZ;
    legScratch.startRadius = startRadius;
    legScratch.endRadius = endRadius;
    legScratch.footRadius = footRadius;
    legScratch.footRotation = heading + fragmentRotation;

    evaluateCubicTube(
      plan.legTube,
      streams,
      entityVertexOffset + (plan.body.legVertexOffsets[leg] ?? 0),
      legScratch,
      writePositions,
      writeNormals,
    );
    evaluateEllipsoid(
      plan.footEllipsoid,
      streams,
      entityVertexOffset + (plan.body.footVertexOffsets[leg] ?? 0),
      legScratch.p3x,
      legScratch.p3y,
      legScratch.p3z,
      footRadius * 1.1,
      footRadius,
      footRadius,
      legScratch.footRotation,
      writePositions,
      writeNormals,
    );
  }

  const abdomenFragment = fragmentOffset + CurveCrawlerFragmentIndex.Abdomen;
  const thoraxFragment = fragmentOffset + CurveCrawlerFragmentIndex.Thorax;
  const abdomenRadiusZ = bodyWidth * 0.42;
  const thoraxRadiusZ = bodyWidth * 0.36;
  const biteForwardOffset = bodyLength * 0.16 * biteAmount;
  evaluateEllipsoid(
    plan.bodyEllipsoid,
    streams,
    entityVertexOffset + plan.body.abdomenVertexOffset,
    originX - headingCosine * (bodyLength * 0.15 + biteForwardOffset * 0.14)
      + (animation.fragmentOffsetX[abdomenFragment] ?? 0),
    originY - headingSine * (bodyLength * 0.15 + biteForwardOffset * 0.14)
      + (animation.fragmentOffsetY[abdomenFragment] ?? 0),
    abdomenRadiusZ * (0.92 - crouchAmount * 0.22) + (animation.fragmentOffsetZ[abdomenFragment] ?? 0),
    Math.max(bodyLength * 0.48 * fragmentScale, 0.0001),
    Math.max(bodyWidth * 0.52 * fragmentScale, 0.0001),
    Math.max(abdomenRadiusZ * fragmentScale, 0.0001),
    heading + (animation.fragmentRotation[abdomenFragment] ?? 0),
    writePositions,
    writeNormals,
  );
  evaluateEllipsoid(
    plan.bodyEllipsoid,
    streams,
    entityVertexOffset + plan.body.thoraxVertexOffset,
    originX + headingCosine * (bodyLength * 0.28 + biteForwardOffset)
      + (animation.fragmentOffsetX[thoraxFragment] ?? 0),
    originY + headingSine * (bodyLength * 0.28 + biteForwardOffset)
      + (animation.fragmentOffsetY[thoraxFragment] ?? 0),
    thoraxRadiusZ * (1.08 - crouchAmount * 0.2 - biteAmount * 0.12)
      + (animation.fragmentOffsetZ[thoraxFragment] ?? 0),
    Math.max(bodyLength * 0.3 * fragmentScale, 0.0001),
    Math.max(bodyWidth * 0.42 * fragmentScale, 0.0001),
    Math.max(thoraxRadiusZ * fragmentScale, 0.0001),
    heading + (animation.fragmentRotation[thoraxFragment] ?? 0),
    writePositions,
    writeNormals,
  );
}
