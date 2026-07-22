const CURVE_CRAWLER_RENDER_INTERVAL_SECONDS = 1 / 30;
const CURVE_CRAWLER_RENDER_PAGE_SIZE = 16;
const CURVE_CRAWLER_RENDER_PHASE_COUNT = 2;

/** 以固定 16 实体页把完整程序化网格求值均匀错开到相邻帧。 */
export class CurveCrawlerRenderCadence {
  private elapsedByPage = new Float32Array(0);
  private duePages = new Uint8Array(0);

  /** 推进全部页时钟；每页保持相同 30 Hz 目标频率。 */
  public advance(deltaTime: number, entityCapacity: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new Error('Curve Crawler 渲染时钟帧时间必须是有限非负数值。');
    }
    if (!Number.isInteger(entityCapacity) || entityCapacity < 0) {
      throw new Error('Curve Crawler 渲染时钟容量无效。');
    }
    this.ensurePageCapacity(Math.ceil(entityCapacity / CURVE_CRAWLER_RENDER_PAGE_SIZE));
    this.duePages.fill(0);
    const safeDeltaTime = Math.min(deltaTime, CURVE_CRAWLER_RENDER_INTERVAL_SECONDS * 2);
    for (let page = 0; page < this.elapsedByPage.length; page++) {
      const elapsed = (this.elapsedByPage[page] ?? 0) + safeDeltaTime;
      if (elapsed < CURVE_CRAWLER_RENDER_INTERVAL_SECONDS) {
        this.elapsedByPage[page] = elapsed;
        continue;
      }
      this.duePages[page] = 1;
      this.elapsedByPage[page] = elapsed % CURVE_CRAWLER_RENDER_INTERVAL_SECONDS;
    }
  }

  /** 返回指定固定 GPU 槽位所在页本帧是否应该求值。 */
  public isSlotDue(gpuSlot: number): boolean {
    if (!Number.isInteger(gpuSlot) || gpuSlot < 0) {
      throw new Error('Curve Crawler 渲染时钟槽位无效。');
    }
    const page = Math.floor(gpuSlot / CURVE_CRAWLER_RENDER_PAGE_SIZE);
    return (this.duePages[page] ?? 0) !== 0;
  }

  private ensurePageCapacity(pageCount: number): void {
    if (pageCount <= this.elapsedByPage.length) {
      return;
    }
    const previousCount = this.elapsedByPage.length;
    const elapsedByPage = new Float32Array(pageCount);
    elapsedByPage.set(this.elapsedByPage);
    for (let page = previousCount; page < pageCount; page++) {
      const phase = page % CURVE_CRAWLER_RENDER_PHASE_COUNT;
      elapsedByPage[page] = -phase
        * CURVE_CRAWLER_RENDER_INTERVAL_SECONDS
        / CURVE_CRAWLER_RENDER_PHASE_COUNT;
    }
    this.elapsedByPage = elapsedByPage;
    this.duePages = new Uint8Array(pageCount);
  }
}
