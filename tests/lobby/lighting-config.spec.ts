import { describe, expect, it } from 'vitest';
import { LOBBY_KEY_LIGHT_CONFIG } from '../../assets/lobby/model/lobby-lighting-config';

describe('大厅真实灯光配置', () => {
  it('定义面向玩家躯干的主聚光灯参数', () => {
    expect(LOBBY_KEY_LIGHT_CONFIG).toMatchObject({
      nodeName: 'MainSpotlight',
      position: { x: 0, y: 6.65 },
      target: { x: 0, z: -2 },
      up: { x: 0, y: 0, z: 1 },
      color: { red: 255, green: 244, blue: 214 },
      luminousFlux: 9100,
      size: 0.15,
      range: 9.4,
      spotAngle: 45,
      angleAttenuationStrength: 0.59,
      shadowEnabled: false,
      shadowBias: 0.0001,
      shadowNormalBias: 0.01,
    });
    expect(LOBBY_KEY_LIGHT_CONFIG.position.z).toBeCloseTo(0.8);
    expect(LOBBY_KEY_LIGHT_CONFIG.target.y).toBeCloseTo(2.83);
  });

  it('从角色正前上方向躯干投射主光', () => {
    const { position, target } = LOBBY_KEY_LIGHT_CONFIG;
    const directionX = position.x - target.x;
    const directionY = position.y - target.y;
    const directionZ = position.z - target.z;
    const directionLength = Math.hypot(directionX, directionY, directionZ);

    expect(position.z).toBeGreaterThan(target.z);
    expect(directionZ / directionLength).toBeGreaterThan(0.5);
  });

  it('使用不与倾斜照射方向共线的 lookAt 上方向', () => {
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
