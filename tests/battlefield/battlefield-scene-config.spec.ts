import { describe, expect, it } from 'vitest';
import { BATTLEFIELD_LAYOUT } from '../../assets/bundles/battlefield/model/battlefield-layout';

describe('battlefield scene configuration', () => {
  it('starts the production camera at 35 degrees within its debug range', () => {
    expect(BATTLEFIELD_LAYOUT.camera.pitchDegrees).toBe(35);
    expect(BATTLEFIELD_LAYOUT.camera.minimumPitchDegrees).toBe(20);
    expect(BATTLEFIELD_LAYOUT.camera.maximumPitchDegrees).toBe(75);
    expect(BATTLEFIELD_LAYOUT.camera.farClip).toBe(150);
  });

  it('把默认画面顶部的地面交点保留在远裁剪面之前', () => {
    const camera = BATTLEFIELD_LAYOUT.camera;
    const radiansPerDegree = Math.PI / 180;
    const cameraHeight = BATTLEFIELD_LAYOUT.playerPosition.y
      + camera.targetOffsetY
      + camera.distance * Math.sin(camera.pitchDegrees * radiansPerDegree);
    const topRayPitch = camera.pitchDegrees - camera.verticalFovDegrees * 0.5;
    const topGroundDistance = cameraHeight
      / Math.sin(topRayPitch * radiansPerDegree);

    expect(camera.farClip - topGroundDistance).toBeGreaterThan(20);
  });

});
