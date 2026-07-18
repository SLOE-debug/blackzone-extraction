import { describe, expect, it } from 'vitest';
import { BATTLEFIELD_LAYOUT } from '../../assets/bundles/battlefield/model/battlefield-layout';
import { BATTLEFIELD_LIGHTING } from '../../assets/bundles/battlefield/scene/battlefield-lighting';

describe('battlefield scene configuration', () => {
  it('locks the production camera to a 45 degree overhead angle', () => {
    expect(BATTLEFIELD_LAYOUT.camera.polarAngle).toBeCloseTo(Math.PI * 0.25, 8);
  });

  it('uses only 2600 ambient illuminance with shadows disabled', () => {
    expect(BATTLEFIELD_LIGHTING.ambientIlluminance).toBe(2600);
    expect(BATTLEFIELD_LIGHTING.shadowsEnabled).toBe(false);
  });
});
