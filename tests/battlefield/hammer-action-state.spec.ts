import { describe, expect, it } from 'vitest';
import { WeaponAction } from '../../assets/core/equipment/equipment';
import { BATTLEFIELD_EQUIPMENT_LIBRARY } from '../../assets/bundles/battlefield/equipment/catalog/battlefield-equipment-catalog';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';
import {
  BattlefieldHammerActionState,
  type MutableHammerActionEvents,
} from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-action-state';

const DEFINITION = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.Sledgehammer);
const EVENTS: MutableHammerActionEvents = {
  uppercutImpact: false,
  groundSlamImpact: false,
  spinPulse: false,
  spinFinal: false,
};

describe('大锤动作状态', () => {
  it('普通挥动左右交替且每次只产生一个攻击序列', () => {
    const state = new BattlefieldHammerActionState();
    expect(state.requestSwing(1, 0)).toBe(true);
    expect(state.action).toBe(WeaponAction.WindupLeft);
    const firstSequence = state.attackSequenceId;
    finishCurrentAction(state);

    expect(state.requestSwing(0, 1)).toBe(true);
    expect(state.action).toBe(WeaponAction.WindupRight);
    expect(state.attackSequenceId).toBe(firstSequence + 1);
  });

  it('横向拨杆决定首次起手，同侧连续攻击仍自动交替', () => {
    const state = new BattlefieldHammerActionState();
    expect(state.requestSwing(1, 0, true)).toBe(true);
    expect(state.action).toBe(WeaponAction.WindupRight);
    finishCurrentAction(state);
    expect(state.requestSwing(1, 0, true)).toBe(true);
    expect(state.action).toBe(WeaponAction.WindupLeft);
  });

  it('普通攻击锁定朝向始终与权威攻击方向同向', () => {
    const state = new BattlefieldHammerActionState();
    expect(state.requestSwing(0.6, 0.8)).toBe(true);
    const heading = state.facingLock?.lockedHeading ?? 0;
    const forwardDot = Math.sin(heading) * 0.6 + Math.cos(heading) * 0.8;
    expect(forwardDot).toBeGreaterThan(0.999);
  });

  it('五次确认命中产生一层震势并由升龙消耗', () => {
    const state = new BattlefieldHammerActionState();
    for (let hit = 0; hit < 5; hit++) {
      state.recordConfirmedAttack(DEFINITION);
    }
    expect(state.hitCount).toBe(0);
    expect(state.momentumCharges).toBe(1);
    expect(state.requestUppercut(Math.PI * 0.5)).toBe(true);
    expect(state.momentumCharges).toBe(0);
    expect(state.action).toBe(WeaponAction.Uppercut);
  });

  it('旋转持续时间限制在两到三秒并从第一帧锁定朝向', () => {
    const state = new BattlefieldHammerActionState();
    for (let hit = 0; hit < 5; hit++) {
      state.recordConfirmedAttack(DEFINITION);
    }
    state.update(0.05, DEFINITION, 0.32, EVENTS);
    expect(state.requestSpin(1.2, 2.6)).toBe(true);
    expect(state.facingLock?.lockedHeading).toBeCloseTo(1.2, 6);
    expect(state.facingLock?.remainingSeconds).toBeCloseTo(2.6, 6);
    state.update(0.16, DEFINITION, 0.32, EVENTS);
    expect(EVENTS.spinPulse).toBe(true);
    expect(state.facingLock?.lockedHeading).toBeGreaterThan(1.2);
    const visualHeading = state.facingLock?.lockedHeading ?? 0;
    const forwardDot = Math.sin(visualHeading) * Math.sin(visualHeading)
      + Math.cos(visualHeading) * Math.cos(visualHeading);
    expect(forwardDot).toBeCloseTo(1, 6);
  });

  it('裂地重砸独立消耗震势并在动作中段产生一次冲击', () => {
    const state = new BattlefieldHammerActionState();
    for (let hit = 0; hit < 5; hit++) {
      state.recordConfirmedAttack(DEFINITION);
    }
    state.update(0.05, DEFINITION, 0.32, EVENTS);
    expect(state.requestGroundSlam(0)).toBe(true);
    expect(state.action).toBe(WeaponAction.GroundSlam);
    state.update(0.47, DEFINITION, 0.32, EVENTS);
    expect(EVENTS.groundSlamImpact).toBe(false);
    state.update(0.02, DEFINITION, 0.32, EVENTS);
    expect(EVENTS.groundSlamImpact).toBe(true);
    state.update(0.02, DEFINITION, 0.32, EVENTS);
    expect(EVENTS.groundSlamImpact).toBe(false);
  });
});

function finishCurrentAction(state: BattlefieldHammerActionState): void {
  for (let step = 0; step < 30 && state.action !== WeaponAction.Idle; step++) {
    state.update(0.05, DEFINITION, 0.32, EVENTS);
  }
  expect(state.action).toBe(WeaponAction.Idle);
}
