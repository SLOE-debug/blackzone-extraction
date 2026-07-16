import { describe, expect, it } from 'vitest';
import { LOBBY_KEY_LIGHT_CONFIG } from '../../assets/lobby/model/lobby-lighting-config';

describe('大厅真实聚光灯配置', () => {
  it('只定义面向玩家与地面的主聚光灯参数', () => {
    expect(LOBBY_KEY_LIGHT_CONFIG).toMatchObject({
      nodeName: 'MainSpotlight',
      target: { x: 0, y: 0.05, z: -2 },
      up: { x: 0, y: 0, z: 1 },
      color: { red: 255, green: 224, blue: 184 },
      luminousFlux: 8000,
      size: 0.15,
      range: 9,
      spotAngle: 42,
      angleAttenuationStrength: 0.55,
      shadowEnabled: true,
      shadowBias: 0.0001,
      shadowNormalBias: 0.01,
    });
  });

  it('使用不与垂直照射方向共线的 lookAt 上方向', () => {
    const { position, target, up } = LOBBY_KEY_LIGHT_CONFIG;
    const directionX = target.x - position.x;
    const directionY = target.y - position.y;
    const directionZ = target.z - position.z;
    const crossX = directionY * up.z - directionZ * up.y;
    const crossY = directionZ * up.x - directionX * up.z;
    const crossZ = directionX * up.y - directionY * up.x;

    expect(Math.hypot(crossX, crossY, crossZ)).toBeGreaterThan(0.001);
  });
});
