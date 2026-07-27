import { describe, expect, it } from 'vitest';
import { WeaponAction } from '../../assets/core/equipment/equipment';
import { getHammerActionControlProfile } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-action-control';
import { SLEDGEHAMMER_PROGRESSION } from '../../assets/bundles/battlefield/equipment/items/sledgehammer/sledgehammer-progression';
import { VanguardFacingPolicy } from '../../assets/player/vanguard/model/vanguard-facing-policy';
import { calculateSledgehammerSpinAngle } from '../../assets/bundles/battlefield/equipment/items/sledgehammer/sledgehammer-spin-timeline';
import { calculateRequiredWindupTurnSpeed } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-windup-turn';

describe('大锤统一动作控制配置', () => {
  it('普通攻击各阶段使用独立移速与有限转向策略', () => {
    const windup = getHammerActionControlProfile(WeaponAction.WindupLeft, 0.4);
    const swing = getHammerActionControlProfile(WeaponAction.SwingLeft, 0.4);
    const chain = getHammerActionControlProfile(WeaponAction.ChainPrepareRight, 0.4);
    const recoverEarly = getHammerActionControlProfile(WeaponAction.Recover, 0.25);
    const recoverLate = getHammerActionControlProfile(WeaponAction.Recover, 0.75);

    expect(windup.movementScale).toBe(0.85);
    expect(windup.maximumTurnSpeed).toBeCloseTo(3 * Math.PI, 6);
    expect(swing.movementScale).toBe(0.65);
    expect(swing.facingPolicy).toBe(VanguardFacingPolicy.ContactLocked);
    expect(swing.maximumTurnSpeed).toBeCloseTo(Math.PI * 2 / 3, 6);
    expect(chain.movementScale).toBe(0.75);
    expect(chain.maximumTurnSpeed).toBeCloseTo(Math.PI * 4, 6);
    expect(recoverEarly.movementScale).toBe(0.75);
    expect(recoverEarly.maximumTurnSpeed).toBeCloseTo(Math.PI, 6);
    expect(recoverLate.movementScale).toBe(0.95);
    expect(recoverLate.facingPolicy).toBe(VanguardFacingPolicy.Free);
  });

  it('首次前摇按背后目标角差提高转速且不产生瞬移', () => {
    const speed = calculateRequiredWindupTurnSpeed(0, Math.PI, 0.28);
    expect(speed).toBeCloseTo(Math.PI / (0.28 * 0.85), 6);
    expect(speed).toBeGreaterThan(3 * Math.PI);
    expect(speed).toBeLessThanOrEqual(6 * Math.PI);
  });

  it('旋风统一声明高速移动与战斗无敌', () => {
    const spin = getHammerActionControlProfile(WeaponAction.Spin, 0.5);
    expect(SLEDGEHAMMER_PROGRESSION.spinDurationSeconds).toBe(1.45);
    expect(SLEDGEHAMMER_PROGRESSION.spinRevolutions).toBe(4);
    expect(spin.movementScale).toBe(0.62);
    expect(spin.damageTakenScale).toBe(0);
    expect(spin.combatInvulnerable).toBe(true);
    expect(spin.facingPolicy).toBe(VanguardFacingPolicy.SpinDriven);
    expect(calculateSledgehammerSpinAngle(1.45)).toBeCloseTo(Math.PI * 8, 6);
  });
});
