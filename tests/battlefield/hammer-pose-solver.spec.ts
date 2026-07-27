import { describe, expect, it } from 'vitest';
import { WeaponGrip } from '../../assets/core/equipment/equipment';
import {
  BattlefieldHammerPoseSolver,
  type MutableBattlefieldHammerWorldPose,
} from '../../assets/bundles/battlefield/equipment/animation/battlefield-hammer-pose-solver';

const PROFILE = Object.freeze({
  grip: WeaponGrip.TwoHandHeavy,
  heldScale: 0.5,
  mainGripLocalPosition: Object.freeze({ x: 0, y: 0, z: 0 }),
  supportGripLocalPosition: Object.freeze({ x: 0, y: -0.75, z: 0 }),
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
  mainGripX: 2,
  mainGripY: 3,
  mainGripZ: 4,
  supportGripX: 2,
  supportGripY: 2.625,
  supportGripZ: 4,
});

describe('大锤双握点与锤头姿态求解', () => {
  it('主副握点同时锁定且锤头保持真实锤柄长度', () => {
    const result = createPose();
    new BattlefieldHammerPoseSolver().solve(PROFILE, GRIP, result);
    expect(result.rootX).toBeCloseTo(GRIP.mainGripX, 6);
    expect(result.rootY).toBeCloseTo(GRIP.mainGripY, 6);
    expect(result.rootZ).toBeCloseTo(GRIP.mainGripZ, 6);
    expect(Math.hypot(
      result.headX - GRIP.mainGripX,
      result.headY - GRIP.mainGripY,
      result.headZ - GRIP.mainGripZ,
    )).toBeCloseTo(1.5, 6);
  });

  it('副握点偏离模型挂点时拒绝产生视觉与手臂失步', () => {
    const invalidGrip = { ...GRIP, supportGripX: GRIP.supportGripX + 0.2 };
    expect(() => new BattlefieldHammerPoseSolver().solve(
      PROFILE,
      invalidGrip,
      createPose(),
    )).toThrow(/副握点/);
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
