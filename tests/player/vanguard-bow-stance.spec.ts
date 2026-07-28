import { describe, expect, it } from 'vitest';
import { WeaponAction, WeaponGrip } from '../../assets/core/equipment/equipment';
import { toVanguardWeaponAction } from '../../assets/bundles/battlefield/scene/battlefield-vanguard-weapon-adapter';
import {
  createVanguardTwoHandWeaponTrajectoryPose,
  writeVanguardTwoHandWeaponTrajectory,
} from '../../assets/player/vanguard/animation/vanguard-two-hand-weapon-trajectory';
import { VanguardWeaponAction } from '../../assets/player/vanguard/model/vanguard-weapon-action';
import { validateVanguardControlIntent } from '../../assets/player/vanguard/model/vanguard-control-intent';
import { VanguardFacingPolicy } from '../../assets/player/vanguard/model/vanguard-facing-policy';
import { VanguardWeaponPose } from '../../assets/player/vanguard/model/vanguard-weapon-pose';

describe('主角猎弓拉弓姿态', () => {
  it('双手远程姿态满足角色控制意图稳定契约', () => {
    expect(() => validateVanguardControlIntent({
      moveX: 0,
      moveZ: 0,
      attackX: 0,
      attackZ: 1,
      attacking: false,
      facingPolicy: VanguardFacingPolicy.SoftTarget,
      desiredHeading: 0,
      maximumTurnSpeed: Math.PI * 4,
      weaponPose: VanguardWeaponPose.TwoHandRanged,
      weaponAction: VanguardWeaponAction.BowDraw,
      weaponActionProgress: 0.5,
      weaponActionSide: 0,
    })).not.toThrow();
  });

  it('蓄力和恢复分别映射为拉弓与释放动作', () => {
    expect(toVanguardWeaponAction(
      WeaponAction.Primary,
      WeaponGrip.TwoHandRanged,
    )).toBe(VanguardWeaponAction.BowDraw);
    expect(toVanguardWeaponAction(
      WeaponAction.Recover,
      WeaponGrip.TwoHandRanged,
    )).toBe(VanguardWeaponAction.BowRelease);
  });

  it('蓄力时右手明显后拉，释放时沿相反方向回弹', () => {
    const ready = createVanguardTwoHandWeaponTrajectoryPose();
    const fullDraw = createVanguardTwoHandWeaponTrajectoryPose();
    const released = createVanguardTwoHandWeaponTrajectoryPose();
    writeVanguardTwoHandWeaponTrajectory(
      ready,
      VanguardWeaponAction.BowDraw,
      0,
      0,
      0,
    );
    writeVanguardTwoHandWeaponTrajectory(
      fullDraw,
      VanguardWeaponAction.BowDraw,
      1,
      0,
      0,
    );
    writeVanguardTwoHandWeaponTrajectory(
      released,
      VanguardWeaponAction.BowRelease,
      1,
      0,
      0,
    );

    expect(fullDraw.mainGripZ).toBeLessThan(ready.mainGripZ - 0.3);
    expect(fullDraw.mainGripX).toBeGreaterThan(ready.mainGripX + 0.1);
    expect(released.mainGripX).toBeCloseTo(ready.mainGripX, 6);
    expect(released.mainGripY).toBeCloseTo(ready.mainGripY, 6);
    expect(released.mainGripZ).toBeCloseTo(ready.mainGripZ, 6);
    expect(fullDraw.supportGripWeight).toBe(1);
  });
});
