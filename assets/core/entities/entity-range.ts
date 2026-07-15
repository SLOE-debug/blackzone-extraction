/**
 * 描述实体表中的连续索引范围。
 */
export interface EntityRange {
  readonly start: number;
  readonly count: number;
  readonly end: number;
}

/**
 * 创建经过边界校验的实体范围。
 *
 * @param start 范围起始索引。
 * @param count 范围包含的实体数量。
 * @param limit 允许访问的实体数量上限。
 * @returns 不超过上限的只读实体范围。
 */
export function createEntityRange(start: number, count: number, limit: number): EntityRange {
  if (!Number.isInteger(start) || start < 0) {
    throw new Error('实体范围起始索引必须是非负整数。');
  }
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('实体范围数量必须是非负整数。');
  }
  if (!Number.isInteger(limit) || limit < 0 || start + count > limit) {
    throw new Error('实体范围超过了允许访问的上限。');
  }

  return Object.freeze({
    start,
    count,
    end: start + count,
  });
}
