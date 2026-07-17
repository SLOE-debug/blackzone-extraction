import { describe, expect, it } from 'vitest';
import {
  getRuntimePerformanceProfile,
  RuntimePerformancePlatform,
} from '../../assets/core/performance/runtime-performance-profile';

describe('运行时性能配置', () => {
  it('Web 调度频率避开 60Hz 的同频整数边界', () => {
    const profile = getRuntimePerformanceProfile(RuntimePerformancePlatform.Web);

    expect(profile.schedulerFrameRate).toBe(61);
    expect(simulateWebPacer(60, 60)).toBeLessThan(55);
    expect(simulateWebPacer(profile.schedulerFrameRate, 60)).toBeGreaterThan(59);
  });

  it('Web 与小游戏使用保守首屏比例和物理像素预算', () => {
    const web = getRuntimePerformanceProfile(RuntimePerformancePlatform.Web);
    const miniGame = getRuntimePerformanceProfile(RuntimePerformancePlatform.MiniGame);

    expect(web.initialScale).toBeLessThan(1);
    expect(web.minimumScale).toBe(0.5);
    expect(web.maximumInitialPixelCount).toBe(1_200_000);
    expect(miniGame.maximumScale).toBeLessThan(1);
    expect(miniGame.maximumInitialPixelCount).toBeLessThan(web.maximumInitialPixelCount);
  });
});

/** 用 Cocos Creator 3.8.8 Web Pacer 的帧编号算法模拟带微小抖动的 60Hz rAF。 */
function simulateWebPacer(targetFrameRate: number, displayFrameRate: number): number {
  const frameTime = 1000 / targetFrameRate;
  const durationSeconds = 10;
  const displayFrameCount = displayFrameRate * durationSeconds;
  let frameCount = 0;
  let callbackCount = 0;
  let seed = 0x75bcd15;

  for (let index = 1; index <= displayFrameCount; index++) {
    seed = (Math.imul(1_664_525, seed) + 1_013_904_223) >>> 0;
    const jitter = ((seed / 0x1_0000_0000) * 2 - 1) * 0.35;
    const elapsedTime = index * 1000 / displayFrameRate + jitter;
    const elapsedFrame = Math.floor(elapsedTime / frameTime);
    if (elapsedFrame < frameCount) {
      continue;
    }
    frameCount = elapsedFrame + 1;
    callbackCount++;
  }

  return callbackCount / durationSeconds;
}
