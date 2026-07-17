import { director, game, screen } from 'cc';
import {
  AdaptiveRenderScale,
  calculateInitialRenderScale,
} from './adaptive-render-scale';
import { type RuntimePerformanceProfile } from './runtime-performance-profile';

/** 把类型化性能配置应用到 Cocos 帧调度器与渲染管线。 */
export class RuntimePerformanceController {
  private readonly renderScale: AdaptiveRenderScale;
  private readonly previousFrameRate: string | number;
  private readonly previousRenderScale: number;
  private disposed = false;

  constructor(profile: Readonly<RuntimePerformanceProfile>) {
    const pipeline = director.root?.pipeline;
    if (pipeline === undefined || pipeline === null) {
      throw new Error('应用性能配置时 Cocos 渲染管线尚未初始化。');
    }

    const windowSize = screen.windowSize;
    const initialScale = calculateInitialRenderScale(
      profile,
      windowSize.width,
      windowSize.height,
      profile.maximumInitialPixelCount,
    );
    const renderScaleOptions = Object.freeze({
      ...profile,
      initialScale,
    });
    this.renderScale = new AdaptiveRenderScale(renderScaleOptions);
    this.previousFrameRate = game.frameRate;
    this.previousRenderScale = pipeline.shadingScale;
    game.frameRate = profile.schedulerFrameRate;
    pipeline.shadingScale = this.renderScale.currentScale;
  }

  /** 根据实际帧时间低频调整渲染比例。 */
  public update(deltaTime: number): void {
    if (this.disposed) {
      return;
    }
    const nextScale = this.renderScale.update(deltaTime);
    if (nextScale === null) {
      return;
    }
    const pipeline = director.root?.pipeline;
    if (pipeline !== undefined && pipeline !== null) {
      pipeline.shadingScale = nextScale;
    }
  }

  /** 释放场景级性能控制权并恢复进入场景前的全局设置。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    const pipeline = director.root?.pipeline;
    if (pipeline !== undefined && pipeline !== null) {
      pipeline.shadingScale = this.previousRenderScale;
    }
    game.frameRate = this.previousFrameRate;
    this.disposed = true;
  }
}
