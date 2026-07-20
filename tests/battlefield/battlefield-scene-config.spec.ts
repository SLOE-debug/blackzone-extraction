import { describe, expect, it } from 'vitest';
import { BATTLEFIELD_LAYOUT } from '../../assets/bundles/battlefield/model/battlefield-layout';
import { BATTLEFIELD_LIGHTING } from '../../assets/bundles/battlefield/scene/battlefield-lighting';

describe('battlefield scene configuration', () => {
  it('starts the production camera at 35 degrees within its debug range', () => {
    expect(BATTLEFIELD_LAYOUT.camera.pitchDegrees).toBe(35);
    expect(BATTLEFIELD_LAYOUT.camera.minimumPitchDegrees).toBe(20);
    expect(BATTLEFIELD_LAYOUT.camera.maximumPitchDegrees).toBe(75);
  });

  it('使用最近稳定版本的 2600 环境光且保持全局阴影关闭', () => {
    expect(BATTLEFIELD_LIGHTING.ambientIlluminance).toBe(2600);
    expect(BATTLEFIELD_LIGHTING.shadowsEnabled).toBe(false);
  });
});
