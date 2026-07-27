import { describe, expect, it } from 'vitest';
import { WeaponAction, WeaponGrip } from '../../assets/core/equipment/equipment';
import {
  BattlefieldHammerPoseSolver,
  type MutableBattlefieldHammerWorldPose,
} from '../../assets/bundles/battlefield/equipment/animation/battlefield-hammer-pose-solver';

const PROFILE = Object.freeze({
  grip: WeaponGrip.OneHandHeavy,
  heldScale: 0.5,
  mainGripLocalPosition: Object.freeze({ x: 0, y: 0, z: 0 }),
  hammerHeadLocalPosition: Object.freeze({ x: 0, y: -3, z: 0 }),
  hammerHeadRadius: 0.8,
});

const GRIP = Object.freeze({
  rootX: 2,
  rootY: 3,
  rootZ: 4,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  rotationW: 1,
});

describe('大锤握点与锤头轨迹求解', () => {
  it('模型根始终锁在主握点且锤头保持真实锤柄长度', () => {
    const result = createPose();
    new BattlefieldHammerPoseSolver().solve(PROFILE, GRIP, WeaponAction.SwingLeft, 0.6, -1, result);
    expect(result.rootX).toBeCloseTo(GRIP.rootX, 6);
    expect(result.rootY).toBeCloseTo(GRIP.rootY, 6);
    expect(result.rootZ).toBeCloseTo(GRIP.rootZ, 6);
    expect(Math.hypot(
      result.headX - GRIP.rootX,
      result.headY - GRIP.rootY,
      result.headZ - GRIP.rootZ,
    )).toBeCloseTo(1.5, 6);
  });

  it('左右横扫使用镜像锤头路径而不是共用单一旋转', () => {
    const solver = new BattlefieldHammerPoseSolver();
    const left = createPose();
    const right = createPose();
    solver.solve(PROFILE, GRIP, WeaponAction.SwingLeft, 0.7, -1, left);
    solver.solve(PROFILE, GRIP, WeaponAction.SwingRight, 0.7, 1, right);
    expect(left.headX - GRIP.rootX).toBeCloseTo(-(right.headX - GRIP.rootX), 6);
    expect(left.headZ).toBeCloseTo(right.headZ, 6);
  });
});

function createPose(): MutableBattlefieldHammerWorldPose {
  return {
    rootX: 0,
    rootY: 0,
    rootZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    rotationW: 1,
    headX: 0,
    headY: 0,
    headZ: 0,
  };
}
