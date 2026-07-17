import { type VertexStreams } from '../../../../../core/mesh/vertex-streams';
import { CURVE_CRAWLER_LIQUID_RAY_COUNT } from '../model/curve-crawler-schema';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { type CurveCrawlerMeshPlan } from './curve-crawler-mesh-plan';
import { evaluateLiquidFan } from './kernels/fan-kernel';

/**
 * 直接求值 Curve Crawler 的死亡液体扇面。
 *
 * 液体独立于身体的坍缩状态：爆裂时展开，液化阶段沿世界负 Y 方向收拢。
 */
export function evaluateCurveCrawlerLiquidMesh(
  state: CurveCrawlerState,
  plan: CurveCrawlerMeshPlan,
  entityIndex: number,
  entityVertexOffset: number,
  streams: VertexStreams,
  writePositions: boolean,
  writeNormals: boolean,
): void {
  const { transform, morphology, animation } = state.data;
  const spread = animation.liquidSpread[entityIndex] ?? 0;
  const radiusX = ((morphology.bodyLength[entityIndex] ?? 0) * 0.8
    + (morphology.legLength[entityIndex] ?? 0) * 0.34) * spread;
  const radiusY = ((morphology.bodyWidth[entityIndex] ?? 0) * 0.75
    + (morphology.legLength[entityIndex] ?? 0) * 0.42) * spread;
  evaluateLiquidFan(
    plan.liquidFan,
    streams,
    entityVertexOffset + plan.liquid.vertexOffset,
    transform.x[entityIndex] ?? 0,
    transform.y[entityIndex] ?? 0,
    transform.heading[entityIndex] ?? 0,
    radiusX,
    radiusY,
    morphology.liquidRadiusScales,
    entityIndex * CURVE_CRAWLER_LIQUID_RAY_COUNT,
    animation.liquidDrain[entityIndex] ?? 0,
    writePositions,
    writeNormals,
  );
}
