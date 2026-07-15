import { createEntityRange, type EntityRange } from '../entities/entity-range';

/** 一个固定拓扑渲染批次的索引与实体范围。 */
export interface BatchPartition {
  readonly index: number;
  readonly range: EntityRange;
}

/**
 * 将实体数量切分为不超过安全容量的连续批次。
 */
export function partitionBatches(
  entityCount: number,
  requestedBatchSize: number,
  maximumBatchSize: number,
): readonly BatchPartition[] {
  if (!Number.isInteger(entityCount) || entityCount < 0) {
    throw new Error('实体数量必须是非负整数。');
  }
  if (!Number.isInteger(requestedBatchSize) || requestedBatchSize <= 0) {
    throw new Error('请求批容量必须是正整数。');
  }
  if (!Number.isInteger(maximumBatchSize) || maximumBatchSize <= 0) {
    throw new Error('最大批容量必须是正整数。');
  }

  const batchSize = Math.min(requestedBatchSize, maximumBatchSize);
  const partitions: BatchPartition[] = [];

  for (let start = 0, index = 0; start < entityCount; start += batchSize, index++) {
    partitions.push(Object.freeze({
      index,
      range: createEntityRange(start, Math.min(batchSize, entityCount - start), entityCount),
    }));
  }

  return Object.freeze(partitions);
}
