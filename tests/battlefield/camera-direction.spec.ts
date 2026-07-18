import { describe, expect, it } from 'vitest';
import { writeBattlefieldCameraRelativeDirection } from '../../assets/bundles/battlefield/scene/battlefield-camera-direction';

describe('战场相机相对方向', () => {
  it('默认零方位角把屏幕上方映射为世界负 Z', () => {
    const result = { x: 0, z: 0 };

    writeBattlefieldCameraRelativeDirection(0, 0, 1, result);

    expect(result.x).toBeCloseTo(0, 6);
    expect(result.z).toBeCloseTo(-1, 6);
  });

  it('相机绕到世界正 X 后同步旋转移动与朝向基准', () => {
    const forward = { x: 0, z: 0 };
    const right = { x: 0, z: 0 };

    writeBattlefieldCameraRelativeDirection(Math.PI * 0.5, 0, 1, forward);
    writeBattlefieldCameraRelativeDirection(Math.PI * 0.5, 1, 0, right);

    expect(forward.x).toBeCloseTo(-1, 6);
    expect(forward.z).toBeCloseTo(0, 6);
    expect(right.x).toBeCloseTo(0, 6);
    expect(right.z).toBeCloseTo(-1, 6);
  });

  it('任意相机方位角都保持输入向量长度', () => {
    const result = { x: 0, z: 0 };

    writeBattlefieldCameraRelativeDirection(1.234, 0.6, 0.8, result);

    expect(Math.hypot(result.x, result.z)).toBeCloseTo(1, 6);
  });
});
