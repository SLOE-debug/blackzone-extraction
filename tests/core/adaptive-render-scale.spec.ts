import { describe, expect, it } from 'vitest';
import {
  AdaptiveRenderScale,
  type AdaptiveRenderScaleOptions,
} from '../../assets/core/performance/adaptive-render-scale';

const OPTIONS: AdaptiveRenderScaleOptions = Object.freeze({
  initialScale: 0.9,
  minimumScale: 0.6,
  maximumScale: 1,
  decreaseStep: 0.1,
  increaseStep: 0.05,
  slowFrameRate: 55,
  recoveryFrameRate: 59,
  sampleDuration: 0.5,
  recoverySampleCount: 2,
  discardedDeltaTime: 0.2,
});

describe('自适应渲染比例', () => {
  it('持续低帧率时逐级降低渲染比例', () => {
    const controller = new AdaptiveRenderScale(OPTIONS);

    expect(sample(controller, 45)).toBeCloseTo(0.8);
    expect(sample(controller, 45)).toBeCloseTo(0.7);
  });

  it('只有连续健康窗口达到要求后才恢复清晰度', () => {
    const controller = new AdaptiveRenderScale(OPTIONS);
    sample(controller, 45);

    expect(sample(controller, 60)).toBeNull();
    expect(sample(controller, 60)).toBeCloseTo(0.85);
  });

  it('切后台形成的超长帧不会触发错误降档', () => {
    const controller = new AdaptiveRenderScale(OPTIONS);

    expect(controller.update(0.5)).toBeNull();
    expect(controller.currentScale).toBe(0.9);
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
