import { assertMeshPlan } from '../../../../../core/mesh/mesh-plan';
import { compileFacetedEllipsoidPlan } from '../../../../../core/geometry/faceted/faceted-ellipsoid-plan';
import { compileFacetedCubicTubePlan } from '../../../../../core/geometry/faceted/faceted-cubic-tube-plan';
import {
  CURVE_CRAWLER_LEG_COUNT,
  CURVE_CRAWLER_LIQUID_RAY_COUNT,
} from '../model/curve-crawler-schema';
import {
  CURVE_CRAWLER_BODY_LATITUDE_SEGMENTS,
  CURVE_CRAWLER_BODY_LONGITUDE_SEGMENTS,
  CURVE_CRAWLER_EYE_LATITUDE_SEGMENTS,
  CURVE_CRAWLER_EYE_LONGITUDE_SEGMENTS,
  CURVE_CRAWLER_FOOT_LATITUDE_SEGMENTS,
  CURVE_CRAWLER_FOOT_LONGITUDE_SEGMENTS,
  CURVE_CRAWLER_LEG_RADIAL_SEGMENTS,
  CURVE_CRAWLER_LEG_SEGMENTS,
  CURVE_CRAWLER_SURFACE_TOPOLOGY,
} from './curve-crawler-topology';
import {
  CurveCrawlerMeshSemantic,
  type CurveCrawlerMeshPlan,
} from './curve-crawler-mesh-plan';
import { compileFanSamplePlan } from './kernels/fan-sample-plan';
import { compileCurveCrawlerEmergenceMesh } from './curve-crawler-emergence-mesh-compiler';

/**
 * 编译 Curve Crawler 的单实体局部 MeshPlan。
 *
 * 固定索引和所有采样参数只在此阶段生成一次；运行期仅读取该计划并改写动态流。
 *
 * @returns 可被所有 Curve Crawler 批次共享的固定局部计划。
 */
export function compileCurveCrawlerMeshPlan(): CurveCrawlerMeshPlan {
  const legTube = compileFacetedCubicTubePlan({
    segmentCount: CURVE_CRAWLER_LEG_SEGMENTS,
    radialCount: CURVE_CRAWLER_LEG_RADIAL_SEGMENTS,
    radialJitter: 0.11,
    ringTwist: 0.14,
    seed: 0x781d,
  });
  const footEllipsoid = compileFacetedEllipsoidPlan({
    longitudeCount: CURVE_CRAWLER_FOOT_LONGITUDE_SEGMENTS,
    latitudeCount: CURVE_CRAWLER_FOOT_LATITUDE_SEGMENTS,
    radialJitter: 0.08,
    ringTwist: 0.16,
    seed: 0x2f1a,
  });
  const bodyEllipsoid = compileFacetedEllipsoidPlan({
    longitudeCount: CURVE_CRAWLER_BODY_LONGITUDE_SEGMENTS,
    latitudeCount: CURVE_CRAWLER_BODY_LATITUDE_SEGMENTS,
    radialJitter: 0.1,
    ringTwist: 0.13,
    seed: 0x4c23,
  });
  const eyeEllipsoid = compileFacetedEllipsoidPlan({
    longitudeCount: CURVE_CRAWLER_EYE_LONGITUDE_SEGMENTS,
    latitudeCount: CURVE_CRAWLER_EYE_LATITUDE_SEGMENTS,
    radialJitter: 0.055,
    ringTwist: 0.1,
    seed: 0x6a11,
  });
  const liquidFan = compileFanSamplePlan(CURVE_CRAWLER_LIQUID_RAY_COUNT);
  const emergenceMesh = compileCurveCrawlerEmergenceMesh(bodyEllipsoid);

  const vertexCount = CURVE_CRAWLER_SURFACE_TOPOLOGY.verticesPerEntity;
  const indexCount = CURVE_CRAWLER_SURFACE_TOPOLOGY.indicesPerEntity;
  const indices = new Uint16Array(indexCount);
  const semanticIds = new Uint8Array(vertexCount);
  const legVertexOffsets = new Uint16Array(CURVE_CRAWLER_LEG_COUNT);
  const footVertexOffsets = new Uint16Array(CURVE_CRAWLER_LEG_COUNT);
  const legIndexOffsets = new Uint16Array(CURVE_CRAWLER_LEG_COUNT);
  const footIndexOffsets = new Uint16Array(CURVE_CRAWLER_LEG_COUNT);

  let vertexOffset = 0;
  let indexOffset = 0;
  for (let leg = 0; leg < CURVE_CRAWLER_LEG_COUNT; leg++) {
    legVertexOffsets[leg] = vertexOffset;
    legIndexOffsets[leg] = indexOffset;
    const legVertexEnd = vertexOffset + legTube.vertexCount;
    semanticIds.fill(CurveCrawlerMeshSemantic.Leg, vertexOffset, legVertexEnd);
    appendLocalIndices(indices, indexOffset, vertexOffset, legTube.indices);
    vertexOffset = legVertexEnd;
    indexOffset += legTube.indexCount;

    footVertexOffsets[leg] = vertexOffset;
    footIndexOffsets[leg] = indexOffset;
    const footVertexEnd = vertexOffset + footEllipsoid.vertexCount;
    semanticIds.fill(CurveCrawlerMeshSemantic.Foot, vertexOffset, footVertexEnd);
    appendLocalIndices(indices, indexOffset, vertexOffset, footEllipsoid.indices);
    vertexOffset = footVertexEnd;
    indexOffset += footEllipsoid.indexCount;
  }

  const abdomenVertexOffset = vertexOffset;
  const abdomenIndexOffset = indexOffset;
  const abdomenVertexEnd = vertexOffset + bodyEllipsoid.vertexCount;
  semanticIds.fill(
    CurveCrawlerMeshSemantic.Abdomen,
    abdomenVertexOffset,
    abdomenVertexEnd,
  );
  appendLocalIndices(indices, indexOffset, vertexOffset, bodyEllipsoid.indices);
  vertexOffset = abdomenVertexEnd;
  indexOffset += bodyEllipsoid.indexCount;

  const thoraxVertexOffset = vertexOffset;
  const thoraxIndexOffset = indexOffset;
  const thoraxVertexEnd = vertexOffset + bodyEllipsoid.vertexCount;
  semanticIds.fill(
    CurveCrawlerMeshSemantic.Thorax,
    thoraxVertexOffset,
    thoraxVertexEnd,
  );
  appendLocalIndices(indices, indexOffset, vertexOffset, bodyEllipsoid.indices);
  vertexOffset = thoraxVertexEnd;
  indexOffset += bodyEllipsoid.indexCount;
  const bodyVertexCount = vertexOffset;
  const bodyIndexCount = indexOffset;

  const eyeVertexOffset = vertexOffset;
  const eyeIndexOffset = indexOffset;
  const leftVertexOffset = vertexOffset;
  const leftIndexOffset = indexOffset;
  appendLocalIndices(indices, indexOffset, vertexOffset, eyeEllipsoid.indices);
  vertexOffset += eyeEllipsoid.vertexCount;
  indexOffset += eyeEllipsoid.indexCount;

  const rightVertexOffset = vertexOffset;
  const rightIndexOffset = indexOffset;
  appendLocalIndices(indices, indexOffset, vertexOffset, eyeEllipsoid.indices);
  vertexOffset += eyeEllipsoid.vertexCount;
  indexOffset += eyeEllipsoid.indexCount;
  const eyeVertexCount = vertexOffset - eyeVertexOffset;
  const eyeIndexCount = indexOffset - eyeIndexOffset;
  semanticIds.fill(CurveCrawlerMeshSemantic.Eye, eyeVertexOffset, vertexOffset);

  const liquidVertexOffset = vertexOffset;
  const liquidIndexOffset = indexOffset;
  appendLocalIndices(indices, indexOffset, vertexOffset, liquidFan.indices);
  vertexOffset += liquidFan.vertexCount;
  indexOffset += liquidFan.indexCount;
  semanticIds.fill(CurveCrawlerMeshSemantic.Liquid, liquidVertexOffset, vertexOffset);

  const emergenceVertexOffset = vertexOffset;
  const emergenceIndexOffset = indexOffset;
  appendLocalIndices(indices, indexOffset, vertexOffset, emergenceMesh.indices);
  vertexOffset += emergenceMesh.vertexCount;
  indexOffset += emergenceMesh.indexCount;
  const crackEnd = emergenceVertexOffset + emergenceMesh.eggVertexOffset;
  const eggEnd = crackEnd + emergenceMesh.eggVertexCount;
  semanticIds.fill(
    CurveCrawlerMeshSemantic.EmergenceCrack,
    emergenceVertexOffset,
    crackEnd,
  );
  semanticIds.fill(CurveCrawlerMeshSemantic.EmergenceEgg, crackEnd, eggEnd);
  semanticIds.fill(CurveCrawlerMeshSemantic.EmergenceShard, eggEnd, vertexOffset);

  if (vertexOffset !== vertexCount || indexOffset !== indexCount) {
    throw new Error('Curve Crawler 编译计划的实际计数与固定拓扑声明不一致。');
  }

  const plan: CurveCrawlerMeshPlan = Object.freeze({
    vertexCount,
    indexCount,
    indices,
    semanticIds,
    legTube,
    footEllipsoid,
    bodyEllipsoid,
    eyeEllipsoid,
    liquidFan,
    body: Object.freeze({
      vertexCount: bodyVertexCount,
      indexCount: bodyIndexCount,
      legVertexOffsets,
      footVertexOffsets,
      legIndexOffsets,
      footIndexOffsets,
      abdomenVertexOffset,
      thoraxVertexOffset,
      abdomenIndexOffset,
      thoraxIndexOffset,
    }),
    eyes: Object.freeze({
      vertexOffset: eyeVertexOffset,
      indexOffset: eyeIndexOffset,
      leftVertexOffset,
      rightVertexOffset,
      leftIndexOffset,
      rightIndexOffset,
      vertexCount: eyeVertexCount,
      indexCount: eyeIndexCount,
    }),
    liquid: Object.freeze({
      vertexOffset: liquidVertexOffset,
      indexOffset: liquidIndexOffset,
    }),
    emergence: Object.freeze({
      vertexOffset: emergenceVertexOffset,
      indexOffset: emergenceIndexOffset,
      vertexCount: emergenceMesh.vertexCount,
      indexCount: emergenceMesh.indexCount,
      crackVertexOffset: emergenceMesh.crackVertexOffset,
      crackIndexOffset: emergenceMesh.crackIndexOffset,
      crackIndexCount: emergenceMesh.crackIndexCount,
      eggVertexOffset: emergenceMesh.eggVertexOffset,
      eggVertexCount: emergenceMesh.eggVertexCount,
      eggIndexOffset: emergenceMesh.eggIndexOffset,
      eggIndexCount: emergenceMesh.eggIndexCount,
      shardIndexOffset: emergenceMesh.shardIndexOffset,
      shardIndexCount: emergenceMesh.shardIndexCount,
      eggUnitDirections: emergenceMesh.eggUnitDirections,
      eggSourceVertexIds: emergenceMesh.eggSourceVertexIds,
      shardVertexOffsets: emergenceMesh.shardVertexOffsets,
    }),
  });
  assertMeshPlan(plan);
  return plan;
}

/**
 * 将一个体元的局部索引平移后写入单实体汇总索引缓冲。
 */
function appendLocalIndices(
  target: Uint16Array,
  targetOffset: number,
  vertexOffset: number,
  source: Uint16Array,
): void {
  for (let index = 0; index < source.length; index++) {
    const localIndex = source[index];
    if (localIndex === undefined) {
      throw new Error('体元局部索引缺失。');
    }
    target[targetOffset + index] = vertexOffset + localIndex;
  }
}

/** Curve Crawler 全部批次共享的编译后单实体局部计划。 */
export const curveCrawlerMeshPlan = compileCurveCrawlerMeshPlan();
