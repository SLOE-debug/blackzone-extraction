const SYSTEM_INTERVAL_SECONDS = 1 / 30;
const MAXIMUM_ACCUMULATED_SECONDS = SYSTEM_INTERVAL_SECONDS * 2;
const FRAME_ALIGNMENT_TOLERANCE_SECONDS = 1 / 240;

/**
 * 将群体决策和空间分离限制为 30 Hz，并把两类重任务错开到相邻显示帧。
 *
 * 位移、生命周期和动画仍按显示帧推进，因此降低的是决策采样成本，而不是可见移动帧率。
 */
export class CurveCrawlerSimulationCadence {
  private intentAccumulator = 0;
  private separationAccumulator = SYSTEM_INTERVAL_SECONDS * 0.5;
  private currentIntentDeltaTime = 0;
  private currentSeparationDeltaTime = 0;

  public get intentDeltaTime(): number {
    return this.currentIntentDeltaTime;
  }

  public get separationDeltaTime(): number {
    return this.currentSeparationDeltaTime;
  }

  /** 累计显示帧时间，并为本帧发布零或一个批处理步长。 */
  public advance(deltaTime: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new Error('Curve Crawler 模拟节奏要求有限非负帧时间。');
    }
    this.intentAccumulator = Math.min(
      MAXIMUM_ACCUMULATED_SECONDS,
      this.intentAccumulator + deltaTime,
    );
    this.separationAccumulator = Math.min(
      MAXIMUM_ACCUMULATED_SECONDS,
      this.separationAccumulator + deltaTime,
    );
    if (this.intentAccumulator + FRAME_ALIGNMENT_TOLERANCE_SECONDS
      >= SYSTEM_INTERVAL_SECONDS) {
      this.currentIntentDeltaTime = this.intentAccumulator;
      this.intentAccumulator = 0;
    } else {
      this.currentIntentDeltaTime = 0;
    }
    if (this.separationAccumulator + FRAME_ALIGNMENT_TOLERANCE_SECONDS
      >= SYSTEM_INTERVAL_SECONDS) {
      this.currentSeparationDeltaTime = this.separationAccumulator;
      this.separationAccumulator = 0;
    } else {
      this.currentSeparationDeltaTime = 0;
    }
  }

  /** 无驻留实体时清空时间债务，避免下一次出生首帧执行大步长。 */
  public reset(): void {
    this.intentAccumulator = 0;
    this.separationAccumulator = SYSTEM_INTERVAL_SECONDS * 0.5;
    this.currentIntentDeltaTime = 0;
    this.currentSeparationDeltaTime = 0;
  }

}
