import { type VertexStreams } from '../../assets/core/mesh/vertex-streams';
import { type CurveCrawlerMeshPlan } from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-mesh-plan';
import {
  CURVE_CRAWLER_FRAGMENT_COUNT,
  CURVE_CRAWLER_LEG_COUNT,
  CURVE_CRAWLER_LIQUID_RAY_COUNT,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-schema';
import { type CurveCrawlerState } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-state';

/**
 * 创建只包含编译式 MeshEvaluator 所需字段的最小 SoA 测试状态。
 *
 * 该夹具不依赖 Cocos 资源，便于把网格领域逻辑作为纯 TypedArray 代码验证。
 */
export function createCurveCrawlerMeshTestState(entityCount: number): CurveCrawlerState {
  const fragmentCount = entityCount * CURVE_CRAWLER_FRAGMENT_COUNT;
  const legCount = entityCount * CURVE_CRAWLER_LEG_COUNT;
  const liquidRayCount = entityCount * CURVE_CRAWLER_LIQUID_RAY_COUNT;
  const filled = (count: number, value: number): Float32Array => {
    const values = new Float32Array(count);
    values.fill(value);
    return values;
  };
  const data = {
    transform: {
      x: new Float32Array(Array.from({ length: entityCount }, (_, index) => 10 + index * 20)),
      y: new Float32Array(Array.from({ length: entityCount }, (_, index) => -6 - index * 8)),
      heading: new Float32Array(Array.from({ length: entityCount }, (_, index) => index * 0.4)),
    },
    morphology: {
      bodyLength: filled(entityCount, 6.2),
      bodyWidth: filled(entityCount, 4.1),
      legLength: filled(entityCount, 9.4),
      legWidth: filled(entityCount, 0.74),
      eyeRadius: filled(entityCount, 0.5),
      liquidRadiusScales: filled(liquidRayCount, 1),
    },
    behavior: {
      selectedWaveLeg: new Uint8Array(entityCount),
    },
    animation: {
      phase: new Float32Array(Array.from({ length: entityCount }, (_, index) => index * 0.6)),
      bodyPulse: filled(entityCount, 0),
      crouchAmount: filled(entityCount, 0.12),
      waveAmount: filled(entityCount, 0),
      turnAmount: filled(entityCount, 0),
      turnDirection: filled(entityCount, 1),
      wavePhase: filled(entityCount, 0),
      blinkScale: filled(entityCount, 1),
      hitFlash: filled(entityCount, 0),
      surfaceCollapse: filled(entityCount, 0),
      liquidSpread: filled(entityCount, 0),
      liquidDrain: filled(entityCount, 0),
      fragmentOffsetX: filled(fragmentCount, 0),
      fragmentOffsetY: filled(fragmentCount, 0),
      fragmentOffsetZ: filled(fragmentCount, 0),
      fragmentRotation: filled(fragmentCount, 0),
      legPhaseOffsets: filled(legCount, 0),
    },
  };
  return { count: entityCount, data } as unknown as CurveCrawlerState;
}

/** 为指定连续实体数量分配一份独立的动态顶点流。 */
export function createCurveCrawlerMeshTestStreams(
  plan: CurveCrawlerMeshPlan,
  entityCount: number,
): VertexStreams {
  return {
    positions: new Float32Array(plan.vertexCount * entityCount * 3),
    normals: new Float32Array(plan.vertexCount * entityCount * 3),
    colors: new Float32Array(plan.vertexCount * entityCount * 4),
  };
}
