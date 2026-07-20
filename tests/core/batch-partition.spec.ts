import { describe, expect, it } from 'vitest';
import { GeometryIndexFormat } from '../../assets/core/geometry/buffer-geometry';
import { getMaximumIndexedEntityCount } from '../../assets/core/geometry/fixed-topology';
import { partitionBatches } from '../../assets/core/rendering/batch-partition';
import {
  CURVE_CRAWLER_BODY_TOPOLOGY,
  CURVE_CRAWLER_EMERGENCE_MESH_TOPOLOGY,
  CURVE_CRAWLER_SURFACE_TOPOLOGY,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-topology';

describe('固定拓扑批次切分', () => {
  it('从拓扑计算 Uint16 安全容量', () => {
    expect(CURVE_CRAWLER_BODY_TOPOLOGY).toEqual({
      verticesPerEntity: 506,
      indicesPerEntity: 2256,
    });
    expect(getMaximumIndexedEntityCount(
      CURVE_CRAWLER_BODY_TOPOLOGY,
      GeometryIndexFormat.Uint16,
    )).toBe(129);
  });

  it('Uint32 合并表面把完整群体保留在一个批次', () => {
    const maximumBatchSize = getMaximumIndexedEntityCount(
      CURVE_CRAWLER_SURFACE_TOPOLOGY,
      GeometryIndexFormat.Uint32,
    );
    const partitions = partitionBatches(180, 180, maximumBatchSize);

    expect(CURVE_CRAWLER_EMERGENCE_MESH_TOPOLOGY).toEqual({
      verticesPerEntity: 426,
      indicesPerEntity: 426,
    });
    expect(maximumBatchSize).toBe(4265111);
    expect(partitions).toHaveLength(1);
    expect(partitions[0]?.range).toEqual({ start: 0, count: 180, end: 180 });
  });

  it('请求容量超过索引上限时自动收紧', () => {
    const maximumBatchSize = getMaximumIndexedEntityCount(
      CURVE_CRAWLER_SURFACE_TOPOLOGY,
      GeometryIndexFormat.Uint16,
    );
    const partitions = partitionBatches(340, 500, maximumBatchSize);

    expect(maximumBatchSize).toBe(65);
    expect(partitions.map((partition) => partition.range.count)).toEqual([65, 65, 65, 65, 65, 15]);
  });
});
