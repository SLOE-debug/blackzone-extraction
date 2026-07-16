/** 自适应渲染比例控制器使用的稳定参数。 */
export interface AdaptiveRenderScaleOptions {
  readonly initialScale: number;
  readonly minimumScale: number;
  readonly maximumScale: number;
  readonly decreaseStep: number;
  readonly increaseStep: number;
  readonly slowFrameRate: number;
  readonly recoveryFrameRate: number;
  readonly sampleDuration: number;
  readonly recoverySampleCount: number;
  readonly discardedDeltaTime: number;
}

/** 根据持续帧率调整渲染比例，避免短时抖动反复重建渲染附件。 */
export class AdaptiveRenderScale {
  private scale: number;
  private elapsedTime = 0;
  private frameCount = 0;
  private healthySampleCount = 0;

  constructor(private readonly options: Readonly<AdaptiveRenderScaleOptions>) {
    validateOptions(options);
    this.scale = clamp(options.initialScale, options.minimumScale, options.maximumScale);
  }

  /** 当前应由渲染管线使用的分辨率比例。 */
  public get currentScale(): number {
    return this.scale;
  }

  /**
   * 记录一帧并在采样窗口结束时返回新的渲染比例。
   *
   * @returns 需要应用的新比例；无需修改渲染管线时返回 null。
   */
  public update(deltaTime: number): number | null {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0
      || deltaTime >= this.options.discardedDeltaTime) {
      this.resetSample();
      return null;
    }

    this.elapsedTime += deltaTime;
    this.frameCount++;
    if (this.elapsedTime < this.options.sampleDuration) {
      return null;
    }

    const measuredFrameRate = this.frameCount / this.elapsedTime;
    this.resetSample();
    if (measuredFrameRate < this.options.slowFrameRate) {
      this.healthySampleCount = 0;
      return this.changeScale(-this.options.decreaseStep);
    }
    if (measuredFrameRate >= this.options.recoveryFrameRate) {
      this.healthySampleCount++;
      if (this.healthySampleCount >= this.options.recoverySampleCount) {
        this.healthySampleCount = 0;
        return this.changeScale(this.options.increaseStep);
      }
      return null;
    }

    this.healthySampleCount = 0;
    return null;
  }

  /** 修改并返回发生变化的比例。 */
  private changeScale(delta: number): number | null {
    const nextScale = clamp(
      this.scale + delta,
      this.options.minimumScale,
      this.options.maximumScale,
    );
    if (nextScale === this.scale) {
      return null;
    }
    this.scale = nextScale;
    return nextScale;
  }

  /** 清空当前采样窗口，避免切后台或断点造成误判。 */
  private resetSample(): void {
    this.elapsedTime = 0;
    this.frameCount = 0;
  }
}

/** 校验自适应渲染比例参数之间的约束。 */
function validateOptions(options: Readonly<AdaptiveRenderScaleOptions>): void {
  const values = Object.values(options);
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('自适应渲染比例参数必须全部是有限正数。');
  }
  if (options.minimumScale > options.initialScale
    || options.initialScale > options.maximumScale) {
    throw new Error('初始渲染比例必须位于最小值和最大值之间。');
  }
  if (!Number.isInteger(options.recoverySampleCount)) {
    throw new Error('恢复采样窗口数量必须是正整数。');
  }
  if (options.slowFrameRate >= options.recoveryFrameRate) {
    throw new Error('降档帧率阈值必须低于恢复帧率阈值。');
  }
}

/** 把数值限制在闭区间内。 */
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}
