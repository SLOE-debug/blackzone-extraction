interface MutableStableRange {
  offset: number;
  count: number;
}

/** 为固定容量实体组分配稳定连续槽位，并在释放后合并空闲区间。 */
export class StableRangeAllocator {
  private readonly freeRanges: MutableStableRange[] = [];
  private highWaterMark = 0;

  /** 当前活动分配所需的最大连续容量。 */
  public get requiredCapacity(): number {
    return this.highWaterMark;
  }

  /** 分配指定数量的连续稳定槽位。 */
  public allocate(count: number): number {
    assertRangeCount(count);
    for (let index = 0; index < this.freeRanges.length; index++) {
      const range = this.freeRanges[index];
      if (range === undefined || range.count < count) {
        continue;
      }
      const offset = range.offset;
      range.offset += count;
      range.count -= count;
      if (range.count === 0) {
        this.freeRanges.splice(index, 1);
      }
      return offset;
    }
    const offset = this.highWaterMark;
    this.highWaterMark += count;
    return offset;
  }

  /** 释放连续槽位，并复用相邻空闲范围。 */
  public release(offset: number, count: number): void {
    assertRangeCount(count);
    if (!Number.isInteger(offset) || offset < 0 || offset + count > this.highWaterMark) {
      throw new Error('稳定槽位释放范围无效。');
    }
    let insertionIndex = 0;
    while (insertionIndex < this.freeRanges.length
      && (this.freeRanges[insertionIndex]?.offset ?? 0) < offset) {
      insertionIndex++;
    }
    this.freeRanges.splice(insertionIndex, 0, { offset, count });
    this.mergeFreeRanges();
    this.trimHighWaterMark();
  }

  private mergeFreeRanges(): void {
    for (let index = 1; index < this.freeRanges.length;) {
      const previous = this.freeRanges[index - 1];
      const current = this.freeRanges[index];
      if (previous === undefined || current === undefined
        || previous.offset + previous.count < current.offset) {
        index++;
        continue;
      }
      previous.count = Math.max(
        previous.offset + previous.count,
        current.offset + current.count,
      ) - previous.offset;
      this.freeRanges.splice(index, 1);
    }
  }

  private trimHighWaterMark(): void {
    const tail = this.freeRanges[this.freeRanges.length - 1];
    if (tail === undefined || tail.offset + tail.count !== this.highWaterMark) {
      return;
    }
    this.highWaterMark = tail.offset;
    this.freeRanges.pop();
  }
}

function assertRangeCount(count: number): void {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('稳定槽位数量必须是正整数。');
  }
}
