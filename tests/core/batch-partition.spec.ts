import { describe, expect, it } from 'vitest';
import { GeometryIndexFormat } from '../../assets/core/geometry/buffer-geometry';
import { getMaximumIndexedEntityCount } from '../../assets/core/geometry/fixed-topology';
import { partitionBatches } from '../../assets/core/rendering/batch-partition';
import { CURVE_CRAWLER_BODY_TOPOLOGY } from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-topology';

describe('固定拓扑批次切分', () => {
  it('从拓扑计算 Uint16 安全容量', () => {
    expect(CURVE_CRAWLER_BODY_TOPOLOGY).toEqual({
      verticesPerEntity: 386,
      indicesPerEntity: 1080,
    });
    expect(getMaximumIndexedEntityCount(
      CURVE_CRAWLER_BODY_TOPOLOGY,
      GeometryIndexFormat.Uint16,
    )).toBe(169);
  });

  it('生成无遗漏、无重叠的连续批次', () => {
    const partitions = partitionBatches(180, 96, 169);

    expect(partitions).toHaveLength(2);
    expect(partitions[0]?.range).toEqual({ start: 0, count: 96, end: 96 });
    expect(partitions[1]?.range).toEqual({ start: 96, count: 84, end: 180 });
  });

  it('请求容量超过索引上限时自动收紧', () => {
    const partitions = partitionBatches(340, 500, 169);

    expect(partitions.map((partition) => partition.range.count)).toEqual([169, 169, 2]);
  });
});
