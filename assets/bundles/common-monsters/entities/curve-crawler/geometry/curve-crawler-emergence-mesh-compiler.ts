import { CURVE_CRAWLER_EMERGENCE_TOPOLOGY } from '../model/curve-crawler-emergence';
import { type EllipsoidSamplePlan } from './kernels/ellipsoid-sample-plan';

/** 编译后尚未平移到单实体汇总区段的出生局部拓扑。 */
export interface CompiledCurveCrawlerEmergenceMesh {
  readonly vertexCount: number;
  readonly indexCount: number;
  readonly indices: Uint16Array;
  readonly crackVertexOffset: number;
  readonly eggVertexOffset: number;
  readonly eggVertexCount: number;
  readonly eggUnitDirections: Float32Array;
  readonly eggSourceVertexIds: Uint16Array;
  readonly shardVertexOffsets: Uint16Array;
}

/**
 * 把地裂、独立硬分面蛋壳和四面体碎片编译为顺序索引固定拓扑。
 *
 * 蛋壳按原椭球索引展开为独立三角顶点，运行时可为每个三角面写入统一法线，
 * 不会被平滑法线抹掉 Low Poly 转折。
 */
export function compileCurveCrawlerEmergenceMesh(
  eggSource: Readonly<EllipsoidSamplePlan>,
): CompiledCurveCrawlerEmergenceMesh {
  const topology = CURVE_CRAWLER_EMERGENCE_TOPOLOGY;
  const crackVertexCount = topology.crackRayCount * topology.crackSegmentCount * 6;
  const crackVertexOffset = 0;
  const eggVertexOffset = crackVertexCount;
  const eggVertexCount = eggSource.indexCount;
  const shardVertexOffsets = new Uint16Array(topology.eggShardCount);
  const shardRegionOffset = eggVertexOffset + eggVertexCount;
  for (let shard = 0; shard < topology.eggShardCount; shard++) {
    shardVertexOffsets[shard] = shardRegionOffset + shard * topology.eggShardFaceVertexCount;
  }

  const vertexCount = shardRegionOffset
    + topology.eggShardCount * topology.eggShardFaceVertexCount;
  const indices = new Uint16Array(vertexCount);
  for (let index = 0; index < indices.length; index++) {
    indices[index] = index;
  }

  const eggUnitDirections = new Float32Array(eggVertexCount * 3);
  const eggSourceVertexIds = new Uint16Array(eggVertexCount);
  for (let vertex = 0; vertex < eggVertexCount; vertex++) {
    const sourceVertex = eggSource.indices[vertex];
    if (sourceVertex === undefined) {
      throw new Error(`Curve Crawler 蛋壳采样索引不存在：${vertex}。`);
    }
    eggSourceVertexIds[vertex] = sourceVertex;
    const sourceOffset = sourceVertex * 3;
    const targetOffset = vertex * 3;
    eggUnitDirections[targetOffset] = eggSource.unitDirections[sourceOffset] ?? 0;
    eggUnitDirections[targetOffset + 1] = eggSource.unitDirections[sourceOffset + 1] ?? 0;
    eggUnitDirections[targetOffset + 2] = eggSource.unitDirections[sourceOffset + 2] ?? 0;
  }

  return Object.freeze({
    vertexCount,
    indexCount: indices.length,
    indices,
    crackVertexOffset,
    eggVertexOffset,
    eggVertexCount,
    eggUnitDirections,
    eggSourceVertexIds,
    shardVertexOffsets,
  });
}
