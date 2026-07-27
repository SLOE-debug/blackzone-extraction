import { describe, expect, it } from 'vitest';
import { distanceSquaredToSegment } from '../../assets/bundles/battlefield/population/battlefield-monster-target-registry';

describe('锤头 Swept Capsule 窄相位', () => {
  it('使用有限线段最近点并正确处理端点外目标', () => {
    expect(distanceSquaredToSegment(1, 0.5, 0, 0, 2, 0)).toBeCloseTo(0.25, 6);
    expect(distanceSquaredToSegment(3, 0, 0, 0, 2, 0)).toBeCloseTo(1, 6);
    expect(distanceSquaredToSegment(-1, 0, 0, 0, 2, 0)).toBeCloseTo(1, 6);
  });

  it('零长度扫掠退化为点距离', () => {
    expect(distanceSquaredToSegment(2, 3, 1, 1, 1, 1)).toBeCloseTo(5, 6);
  });
});
