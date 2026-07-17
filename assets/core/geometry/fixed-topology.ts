import { GeometryIndexFormat } from './buffer-geometry';

/** 描述每个实体固定占用的几何容量。 */
export interface FixedTopologyMetrics {
  readonly verticesPerEntity: number;
  readonly indicesPerEntity: number;
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
