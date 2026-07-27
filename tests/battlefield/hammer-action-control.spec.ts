import { describe, expect, it } from 'vitest';
import { WeaponAction } from '../../assets/core/equipment/equipment';
import { getHammerActionControlProfile } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-action-control';
import { SLEDGEHAMMER_PROGRESSION } from '../../assets/bundles/battlefield/equipment/items/sledgehammer/sledgehammer-progression';
import { VanguardFacingPolicy } from '../../assets/player/vanguard/model/vanguard-facing-policy';
import { calculateSledgehammerSpinAngle } from '../../assets/bundles/battlefield/equipment/items/sledgehammer/sledgehammer-spin-timeline';

describe('大锤统一动作控制配置', () => {
  it('普通攻击各阶段使用独立移速与有限转向策略', () => {
    const windup = getHammerActionControlProfile(WeaponAction.WindupLeft, 0.4);
    const swing = getHammerActionControlProfile(WeaponAction.SwingLeft, 0.4);
    const chain = getHammerActionControlProfile(WeaponAction.ChainPrepareRight, 0.4);
    const recoverEarly = getHammerActionControlProfile(WeaponAction.Recover, 0.25);
    const recoverLate = getHammerActionControlProfile(WeaponAction.Recover, 0.75);

    expect(windup.movementScale).toBe(0.65);
    expect(windup.maximumTurnSpeed).toBeCloseTo(3 * Math.PI, 6);
    expect(swing.movementScale).toBe(0.35);
    expect(swing.facingPolicy).toBe(VanguardFacingPolicy.ContactLocked);
    expect(swing.maximumTurnSpeed).toBeCloseTo(Math.PI * 0.5, 6);
    expect(chain.movementScale).toBe(0.55);
    expect(chain.maximumTurnSpeed).toBeCloseTo(Math.PI * 2, 6);
    expect(recoverEarly.movementScale).toBe(0.55);
    expect(recoverLate.movementScale).toBe(0.8);
    expect(recoverLate.facingPolicy).toBe(VanguardFacingPolicy.Free);
  });

  it('旋风统一声明高速移动与百分之四十五承伤', () => {
    const spin = getHammerActionControlProfile(WeaponAction.Spin, 0.5);
    expect(SLEDGEHAMMER_PROGRESSION.spinDurationSeconds).toBe(1.45);
    expect(SLEDGEHAMMER_PROGRESSION.spinRevolutions).toBe(4);
    expect(spin.movementScale).toBe(0.62);
    expect(spin.damageTakenScale).toBe(0.45);
    expect(spin.facingPolicy).toBe(VanguardFacingPolicy.SpinDriven);
    expect(calculateSledgehammerSpinAngle(1.45)).toBeCloseTo(Math.PI * 8, 6);
  });
});
