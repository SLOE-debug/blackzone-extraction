/** 自适应渲染比例控制器使用的稳定参数。 */
export interface AdaptiveRenderScaleOptions {
  readonly initialScale: number;
  readonly minimumScale: number;
  readonly maximumScale: number;
  readonly decreaseStep: number;
  readonly criticalDecreaseStep: number;
  readonly criticalFrameRate: number;
  readonly increaseStep: number;
  readonly slowFrameRate: number;
  readonly recoveryFrameRate: number;
  readonly sampleDuration: number;
  readonly recoverySampleCount: number;
  readonly recoveryProbeGraceSampleCount: number;
  readonly discardedDeltaTime: number;
}

interface RecoveryProbe {
  readonly stableScale: number;
  remainingGraceSampleCount: number;
}

/** 根据持续帧率调整渲染比例，避免短时抖动反复重建渲染附件。 */
export class AdaptiveRenderScale {
  private scale: number;
  private recoveryScaleCeiling: number;
  private recoveryProbe: RecoveryProbe | null = null;
  private elapsedTime = 0;
  private frameCount = 0;
  private healthySampleCount = 0;

  constructor(private readonly options: Readonly<AdaptiveRenderScaleOptions>) {
    validateOptions(options);
    this.scale = clamp(options.initialScale, options.minimumScale, options.maximumScale);
    this.recoveryScaleCeiling = options.maximumScale;
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
    if (this.recoveryProbe !== null) {
      if (this.recoveryProbe.remainingGraceSampleCount > 0) {
        this.recoveryProbe.remainingGraceSampleCount--;
        return null;
      }
      if (measuredFrameRate < this.options.recoveryFrameRate) {
        const stableScale = this.recoveryProbe.stableScale;
        this.recoveryScaleCeiling = Math.min(this.recoveryScaleCeiling, stableScale);
        this.recoveryProbe = null;
        this.healthySampleCount = 0;
        return this.setScale(stableScale);
      }
      this.recoveryProbe = null;
      this.healthySampleCount = 0;
      return null;
    }

    if (measuredFrameRate < this.options.slowFrameRate) {
      this.healthySampleCount = 0;
      const decreaseStep = measuredFrameRate < this.options.criticalFrameRate
        ? this.options.criticalDecreaseStep
        : this.options.decreaseStep;
      return this.changeScale(-decreaseStep);
    }
    if (measuredFrameRate >= this.options.recoveryFrameRate
      && this.scale < this.recoveryScaleCeiling) {
      this.healthySampleCount++;
      if (this.healthySampleCount >= this.options.recoverySampleCount) {
        this.healthySampleCount = 0;
        return this.startRecoveryProbe();
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
    return this.setScale(nextScale);
  }

  /** 试探更高清晰度，并保存失败时需要恢复的稳定档位。 */
  private startRecoveryProbe(): number | null {
    const nextScale = clamp(
      this.scale + this.options.increaseStep,
      this.options.minimumScale,
      this.recoveryScaleCeiling,
    );
    if (nextScale === this.scale) {
      return null;
    }
    this.recoveryProbe = {
      stableScale: this.scale,
      remainingGraceSampleCount: this.options.recoveryProbeGraceSampleCount,
    };
    this.scale = nextScale;
    return nextScale;
  }

  /** 应用已完成边界计算的新渲染比例。 */
  private setScale(nextScale: number): number | null {
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
  const values = [
    options.initialScale,
    options.minimumScale,
    options.maximumScale,
    options.decreaseStep,
    options.criticalDecreaseStep,
    options.criticalFrameRate,
    options.increaseStep,
    options.slowFrameRate,
    options.recoveryFrameRate,
    options.sampleDuration,
    options.recoverySampleCount,
    options.discardedDeltaTime,
  ];
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
  if (!Number.isInteger(options.recoveryProbeGraceSampleCount)
    || options.recoveryProbeGraceSampleCount < 0) {
    throw new Error('恢复探测宽限窗口数量必须是非负整数。');
  }
  if (options.criticalFrameRate >= options.slowFrameRate
    || options.slowFrameRate >= options.recoveryFrameRate) {
    throw new Error('严重掉帧、降档和恢复阈值必须依次递增。');
  }
  if (options.criticalDecreaseStep < options.decreaseStep) {
    throw new Error('严重掉帧的降档步长不得小于普通降档步长。');
  }
}

/**
 * 根据物理画布像素预算限制启动分辨率，避免高 DPR 设备首屏直接满载。
 *
 * @param options 自适应渲染比例的稳定边界。
 * @param width 画布物理像素宽度。
 * @param height 画布物理像素高度。
 * @param maximumPixelCount 首屏允许着色的最大像素数量。
 * @returns 同时满足配置上限与像素预算的启动渲染比例。
 */
export function calculateInitialRenderScale(
  options: Readonly<AdaptiveRenderScaleOptions>,
  width: number,
  height: number,
  maximumPixelCount: number,
): number {
  if (![width, height, maximumPixelCount].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('画布尺寸和首屏像素预算必须是有限正数。');
  }
  const budgetScale = Math.sqrt(maximumPixelCount / (width * height));
  return clamp(
    Math.min(options.initialScale, budgetScale),
    options.minimumScale,
    options.maximumScale,
  );
}

/** 把数值限制在闭区间内。 */
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}
