import { describe, expect, it } from 'vitest';
import { BATTLEFIELD_LAYOUT } from '../../assets/bundles/battlefield/model/battlefield-layout';
import { BATTLEFIELD_LIGHTING } from '../../assets/bundles/battlefield/scene/battlefield-lighting';

describe('battlefield scene configuration', () => {
  it('starts the production camera at 35 degrees within its debug range', () => {
    expect(BATTLEFIELD_LAYOUT.camera.pitchDegrees).toBe(35);
    expect(BATTLEFIELD_LAYOUT.camera.minimumPitchDegrees).toBe(20);
    expect(BATTLEFIELD_LAYOUT.camera.maximumPitchDegrees).toBe(75);
  });

  it('uses only 2600 ambient illuminance with shadows disabled', () => {
    expect(BATTLEFIELD_LIGHTING.ambientIlluminance).toBe(2600);
    expect(BATTLEFIELD_LIGHTING.shadowsEnabled).toBe(false);
  });
});
