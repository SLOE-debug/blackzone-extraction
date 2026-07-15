import { type EntityRange } from '../entities/entity-range';
import { GeometryIndexFormat } from './buffer-geometry';
import { type TriangleMeshWriter } from './triangle-mesh-writer';

/** 描述每个实体固定占用的几何容量。 */
export interface FixedTopologyMetrics {
  readonly verticesPerEntity: number;
  readonly indicesPerEntity: number;
}

/**
 * 定义能够把实体范围写入固定拓扑几何的来源。
 *
 * @typeParam TSource 几何写入所读取的强类型实体状态。
 */
export interface FixedTopologyGeometrySource<TSource> {
  readonly metrics: FixedTopologyMetrics;
  write(writer: TriangleMeshWriter, source: TSource, range: EntityRange): void;
}

/** 计算实体范围需要的总顶点数。 */
export function getTopologyVertexCount(metrics: FixedTopologyMetrics, entityCount: number): number {
  return metrics.verticesPerEntity * entityCount;
}

/** 计算实体范围需要的总索引数。 */
export function getTopologyIndexCount(metrics: FixedTopologyMetrics, entityCount: number): number {
  return metrics.indicesPerEntity * entityCount;
}

/**
 * 根据索引格式计算单个批次能够安全容纳的实体数量。
 */
export function getMaximumIndexedEntityCount(
  metrics: FixedTopologyMetrics,
  indexFormat: GeometryIndexFormat,
): number {
  const maximumVertexIndex = indexFormat === GeometryIndexFormat.Uint16 ? 65535 : 0xffffffff;
  return Math.max(1, Math.floor(maximumVertexIndex / metrics.verticesPerEntity));
}
