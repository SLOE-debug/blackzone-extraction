import { describe, expect, it } from 'vitest';
import { BattlefieldHammerSpinArcSampler } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-spin-arc-sampler';

describe('高速旋风圆弧子步扫掠', () => {
  it('最差五十度单帧拆为四段并让全部端点贴合真实圆弧', () => {
    const sampler = new BattlefieldHammerSpinArcSampler();
    const deltaAngle = 50 * Math.PI / 180;
    sampler.updateCenter(0, 0);
    const segmentCount = sampler.writeSegments(
      0,
      2,
      Math.sin(deltaAngle) * 2,
      Math.cos(deltaAngle) * 2,
      deltaAngle,
    );

    expect(segmentCount).toBe(4);
    for (let segment = 0; segment < segmentCount; segment++) {
      expect(Math.hypot(
        sampler.endX[segment] ?? 0,
        sampler.endZ[segment] ?? 0,
      )).toBeCloseTo(2, 5);
      if (segment > 0) {
        expect(sampler.startX[segment]).toBeCloseTo(sampler.endX[segment - 1] ?? 0, 6);
        expect(sampler.startZ[segment]).toBeCloseTo(sampler.endZ[segment - 1] ?? 0, 6);
      }
    }
  });
});
