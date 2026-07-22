interface MutableCurveCrawlerGpuSlotRange {
  offset: number;
  count: number;
}

/**
 * 为共享怪物批次分配稳定 GPU 实体槽位。
 *
 * 槽位只在群体注册和注销时变化；实体进出视锥不会改变其他实体的顶点偏移。
 */
export class CurveCrawlerGpuSlotAllocator {
  private readonly freeRanges: MutableCurveCrawlerGpuSlotRange[] = [];
  private highWaterMark = 0;

  /** 当前活动分配所需的最大槽位前缀。 */
  public get requiredCapacity(): number {
    return this.highWaterMark;
  }

  /** 为一个固定容量群体分配连续槽位。 */
  public allocate(count: number): number {
    assertSlotCount(count);
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

  /** 归还连续槽位，并合并相邻空闲区段。 */
  public release(offset: number, count: number): void {
    assertSlotCount(count);
    if (!Number.isInteger(offset) || offset < 0 || offset + count > this.highWaterMark) {
      throw new Error('Curve Crawler GPU 槽位释放范围无效。');
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

function assertSlotCount(count: number): void {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('Curve Crawler GPU 槽位数量必须是正整数。');
  }
}
