import { describe, expect, it } from 'vitest';
import {
  AdaptiveRenderScale,
  calculateInitialRenderScale,
  type AdaptiveRenderScaleOptions,
} from '../../assets/core/performance/adaptive-render-scale';

const OPTIONS: AdaptiveRenderScaleOptions = Object.freeze({
  initialScale: 0.9,
  minimumScale: 0.6,
  maximumScale: 1,
  decreaseStep: 0.1,
  criticalDecreaseStep: 0.2,
  criticalFrameRate: 40,
  increaseStep: 0.05,
  slowFrameRate: 55,
  recoveryFrameRate: 59,
  sampleDuration: 0.5,
  recoverySampleCount: 2,
  recoveryProbeGraceSampleCount: 1,
  discardedDeltaTime: 0.2,
});

describe('自适应渲染比例', () => {
  it('持续低帧率时逐级降低渲染比例', () => {
    const controller = new AdaptiveRenderScale(OPTIONS);

    expect(sample(controller, 45)).toBeCloseTo(0.8);
    expect(sample(controller, 45)).toBeCloseTo(0.7);
  });

  it('严重掉帧时使用更大的步长快速降低像素压力', () => {
    const controller = new AdaptiveRenderScale(OPTIONS);

    expect(sample(controller, 30)).toBeCloseTo(0.7);
    expect(sample(controller, 30)).toBeCloseTo(0.6);
  });

  it('只有连续健康窗口达到要求后才试探更高清晰度', () => {
    const controller = new AdaptiveRenderScale(OPTIONS);
    sample(controller, 45);

    expect(sample(controller, 60)).toBeNull();
    expect(sample(controller, 60)).toBeCloseTo(0.85);
    expect(sample(controller, 60)).toBeNull();
    expect(sample(controller, 60)).toBeNull();
    expect(controller.currentScale).toBeCloseTo(0.85);
  });

  it('恢复探测失败后回到稳定档位并记住本次上限', () => {
    const controller = new AdaptiveRenderScale(OPTIONS);
    sample(controller, 45);
    sample(controller, 60);
    expect(sample(controller, 60)).toBeCloseTo(0.85);

    expect(sample(controller, 60)).toBeNull();
    expect(sample(controller, 50)).toBeCloseTo(0.8);
    expect(controller.currentScale).toBeCloseTo(0.8);
    for (let index = 0; index < 6; index++) {
      expect(sample(controller, 60)).toBeNull();
    }
    expect(controller.currentScale).toBeCloseTo(0.8);
  });

  it('切后台形成的超长帧不会触发错误降档', () => {
    const controller = new AdaptiveRenderScale(OPTIONS);

    expect(controller.update(0.5)).toBeNull();
    expect(controller.currentScale).toBe(0.9);
  });

  it('按物理画布像素预算限制首屏渲染比例', () => {
    expect(calculateInitialRenderScale(OPTIONS, 2560, 1440, 921_600)).toBeCloseTo(0.6);
    expect(calculateInitialRenderScale(OPTIONS, 1280, 720, 2_000_000)).toBeCloseTo(0.9);
  });
});

/** 用稳定帧率填满一个采样窗口并返回最后一次比例决策。 */
function sample(controller: AdaptiveRenderScale, frameRate: number): number | null {
  const deltaTime = 1 / frameRate;
  let result: number | null = null;
  for (let elapsed = 0; elapsed < OPTIONS.sampleDuration; elapsed += deltaTime) {
    result = controller.update(deltaTime) ?? result;
  }
  return result;
}
