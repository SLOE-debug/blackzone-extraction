import { describe, expect, it } from 'vitest';
import { WeaponAction } from '../../assets/core/equipment/equipment';
import { BATTLEFIELD_EQUIPMENT_LIBRARY } from '../../assets/bundles/battlefield/equipment/catalog/battlefield-equipment-catalog';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';
import {
  BattlefieldHammerActionState,
} from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-action-state';
import {
  type MutableHammerActionEvents,
} from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-action-events';

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
    expect(state.requestSwing(1, 0, 0)).toBe(true);
    expect(state.action).toBe(WeaponAction.WindupLeft);
    const firstSequence = state.attackSequenceId;
    finishCurrentAction(state);

    expect(state.requestSwing(0, 1, 0)).toBe(true);
    expect(state.action).toBe(WeaponAction.WindupRight);
    expect(state.attackSequenceId).toBe(firstSequence + 1);
  });

  it('横向拨杆决定首次起手，同侧连续攻击仍自动交替', () => {
    const state = new BattlefieldHammerActionState();
    expect(state.requestSwing(1, 0, 0, true)).toBe(true);
    expect(state.action).toBe(WeaponAction.WindupRight);
    finishCurrentAction(state);
    expect(state.requestSwing(1, 0, 0, true)).toBe(true);
    expect(state.action).toBe(WeaponAction.WindupLeft);
  });

  it('普通攻击锁定朝向始终与权威攻击方向同向', () => {
    const state = new BattlefieldHammerActionState();
    expect(state.requestSwing(0.6, 0.8, 0)).toBe(true);
    const heading = state.actionControl.desiredHeading;
    const forwardDot = Math.sin(heading) * 0.6 + Math.cos(heading) * 0.8;
    expect(forwardDot).toBeGreaterThan(0.999);
  });

  it('首次前摇面对背后目标时把动态转速写入动作控制', () => {
    const state = new BattlefieldHammerActionState();
    expect(state.requestSwing(0, -1, 0)).toBe(true);
    expect(state.actionControl.maximumTurnSpeed).toBeGreaterThan(3 * Math.PI);
    expect(state.actionControl.maximumTurnSpeed).toBeLessThanOrEqual(6 * Math.PI);
  });

  it('一次挥动中拒绝新方向并保持动作开始时的目标朝向', () => {
    const state = new BattlefieldHammerActionState();
    expect(state.requestSwing(0.6, 0.8, 0)).toBe(true);
    const lockedHeading = state.actionControl.desiredHeading;
    expect(state.requestSwing(-1, 0, 0)).toBe(false);
    expect(state.actionControl.desiredHeading).toBe(lockedHeading);
    expect(state.directionX).toBeCloseTo(0.6, 6);
    expect(state.directionZ).toBeCloseTo(0.8, 6);
  });

  it('持续按住两秒会直接衔接左右连段且第一击后不出现 Idle 帧', () => {
    const state = new BattlefieldHammerActionState();
    state.setAttackHeld(true);
    expect(state.requestSwing(0, 1, 0)).toBe(true);
    let observedFirstSwing = false;
    let idleAfterFirstSwing = false;
    for (let frame = 0; frame < 120; frame++) {
      if (state.canBufferNextSwing) {
        expect(state.requestSwing(frame % 2 === 0 ? 1 : -1, 0, 0)).toBe(true);
      }
      state.update(1 / 60, DEFINITION, EVENTS);
      observedFirstSwing ||= state.action === WeaponAction.SwingLeft;
      idleAfterFirstSwing ||= observedFirstSwing && state.action === WeaponAction.Idle;
    }
    expect(observedFirstSwing).toBe(true);
    expect(idleAfterFirstSwing).toBe(false);
    expect(state.attackSequenceId).toBeGreaterThan(3);
  });

  it('缓存下一击只在新挥动开始时更新锁定方向', () => {
    const state = new BattlefieldHammerActionState();
    state.setAttackHeld(true);
    state.requestSwing(0, 1, 0);
    state.update(0.28, DEFINITION, EVENTS);
    state.update(0.21, DEFINITION, EVENTS);
    expect(state.canBufferNextSwing).toBe(true);
    expect(state.requestSwing(1, 0, 0)).toBe(true);
    expect(state.directionX).toBe(0);
    expect(state.directionZ).toBe(1);
    state.update(0.13, DEFINITION, EVENTS);
    expect(state.action).toBe(WeaponAction.ChainPrepareRight);
    expect(state.directionX).toBe(1);
    expect(state.directionZ).toBe(0);
  });

  it('单帧越过蓄力边界时把剩余时间推进到挥动阶段', () => {
    const state = new BattlefieldHammerActionState();
    state.requestSwing(0, 1, 0);
    state.update(0.3, DEFINITION, EVENTS);
    expect(state.action).toBe(WeaponAction.SwingLeft);
    expect(state.progress).toBeCloseTo(0.02 / 0.34, 6);
  });

  it('三种帧率下两秒持续连段产生相同挥击序列数', () => {
    const sequenceCounts = [30, 60, 120].map(simulateHeldCombo);
    expect(sequenceCounts[0]).toBe(sequenceCounts[1]);
    expect(sequenceCounts[1]).toBe(sequenceCounts[2]);
  });

  it('命中停顿期间仍允许缓存下一击，松开后则完成当前挥动并恢复', () => {
    const state = new BattlefieldHammerActionState();
    state.setAttackHeld(true);
    state.requestSwing(0, 1, 0);
    state.update(0.33, DEFINITION, EVENTS);
    expect(state.action).toBe(WeaponAction.SwingLeft);
    expect(state.canBufferNextSwing).toBe(false);
    state.recordConfirmedAttack(DEFINITION);
    expect(state.canBufferNextSwing).toBe(true);
    expect(state.requestSwing(1, 0, 0)).toBe(true);
    state.update(0.04, DEFINITION, EVENTS);
    expect(state.action).toBe(WeaponAction.SwingLeft);
    state.setAttackHeld(false);
    finishCurrentAction(state);
  });

  it('五次确认命中产生一层震势并由旋风消耗', () => {
    const state = new BattlefieldHammerActionState();
    for (let hit = 0; hit < 5; hit++) {
      state.recordConfirmedAttack(DEFINITION);
    }
    expect(state.hitCount).toBe(0);
    expect(state.momentumCharges).toBe(1);
    expect(state.requestSpin(Math.PI * 0.5)).toBe(true);
    expect(state.momentumCharges).toBe(0);
    expect(state.action).toBe(WeaponAction.Spin);
  });

  it('两段横扫完成后自动进入群体上挑且上挑完成后段位归零', () => {
    const state = new BattlefieldHammerActionState();
    state.setAttackHeld(true);
    expect(state.requestSwing(0, 1, 0)).toBe(true);
    let firstSwingCompleted = false;
    for (let frame = 0; frame < 180 && state.action !== WeaponAction.Uppercut; frame++) {
      if (state.canBufferNextSwing) {
        expect(state.requestSwing(0, 1, 0)).toBe(true);
      }
      state.update(1 / 60, DEFINITION, EVENTS);
      if (state.completedNormalSwings === 1) {
        firstSwingCompleted = true;
      }
    }
    expect(firstSwingCompleted).toBe(true);
    expect(state.action).toBe(WeaponAction.Uppercut);
    expect(state.completedNormalSwings).toBe(2);
    while (!state.canBufferNextSwing) {
      state.update(1 / 60, DEFINITION, EVENTS);
    }
    expect(state.requestSwing(1, 0, 0)).toBe(true);
    state.update(0.2, DEFINITION, EVENTS);
    expect(state.completedNormalSwings).toBe(0);
    expect(state.action).toBe(WeaponAction.ChainPrepareLeft);
  });

  it('同一普通攻击序列命中多只怪物只累计一次震势有效命中', () => {
    const state = new BattlefieldHammerActionState();
    state.requestSwing(0, 1, 0);
    for (let target = 0; target < 10; target++) {
      state.recordConfirmedAttack(DEFINITION);
    }
    expect(state.hitCount).toBe(1);
    expect(state.completedNormalSwings).toBe(0);
  });

  it('普通连段收势与主动技能成功开始都会清空自动上挑段位', () => {
    const released = new BattlefieldHammerActionState();
    released.setAttackHeld(true);
    released.requestSwing(0, 1, 0);
    while (!released.canBufferNextSwing) {
      released.update(1 / 60, DEFINITION, EVENTS);
    }
    released.requestSwing(0, 1, 0);
    released.setAttackHeld(false);
    finishCurrentAction(released);
    expect(released.completedNormalSwings).toBe(0);

    const skilled = new BattlefieldHammerActionState();
    for (let hit = 0; hit < 5; hit++) {
      skilled.recordConfirmedAttack(DEFINITION);
    }
    expect(skilled.requestGroundSlam(0)).toBe(true);
    expect(skilled.completedNormalSwings).toBe(0);
  });

  it('旋风使用一点四五秒四圈时间轴并按半圈更新伤害序列', () => {
    const state = new BattlefieldHammerActionState();
    for (let hit = 0; hit < 5; hit++) {
      state.recordConfirmedAttack(DEFINITION);
    }
    state.update(0.05, DEFINITION, EVENTS);
    expect(state.requestSpin(1.2)).toBe(true);
    expect(state.actionControl.desiredHeading).toBeCloseTo(1.2, 6);
    expect(state.actionControl.remainingSeconds).toBeCloseTo(1.45, 6);
    const firstWindow = state.attackSequenceId;
    state.update(0.22, DEFINITION, EVENTS);
    expect(EVENTS.spinPulse).toBe(true);
    expect(state.attackSequenceId).toBe(firstWindow + 1);
    expect(state.actionControl.desiredHeading).toBeGreaterThan(1.2 + Math.PI);
    const visualHeading = state.actionControl.desiredHeading;
    const forwardDot = Math.sin(visualHeading) * Math.sin(visualHeading)
      + Math.cos(visualHeading) * Math.cos(visualHeading);
    expect(forwardDot).toBeCloseTo(1, 6);
  });

  it('完整四圈旋风产生八个半圈窗口和一个独立最终重击序列', () => {
    const state = new BattlefieldHammerActionState();
    for (let hit = 0; hit < 5; hit++) {
      state.recordConfirmedAttack(DEFINITION);
    }
    state.update(0.05, DEFINITION, EVENTS);
    expect(state.requestSpin(0)).toBe(true);
    const firstWindow = state.attackSequenceId;
    for (let step = 0; step < 40 && state.action !== WeaponAction.Idle; step++) {
      state.update(0.05, DEFINITION, EVENTS);
    }
    expect(state.action).toBe(WeaponAction.Idle);
    expect(state.attackSequenceId - firstWindow + 1).toBe(9);
  });

  it('裂地重砸独立消耗震势并在动作中段产生一次冲击', () => {
    const state = new BattlefieldHammerActionState();
    for (let hit = 0; hit < 5; hit++) {
      state.recordConfirmedAttack(DEFINITION);
    }
    state.update(0.05, DEFINITION, EVENTS);
    expect(state.requestGroundSlam(0)).toBe(true);
    expect(state.action).toBe(WeaponAction.GroundSlam);
    state.update(0.47, DEFINITION, EVENTS);
    expect(EVENTS.groundSlamImpact).toBe(false);
    state.update(0.02, DEFINITION, EVENTS);
    expect(EVENTS.groundSlamImpact).toBe(true);
    state.update(0.02, DEFINITION, EVENTS);
    expect(EVENTS.groundSlamImpact).toBe(false);
  });
});

function finishCurrentAction(state: BattlefieldHammerActionState): void {
  for (let step = 0; step < 30 && state.action !== WeaponAction.Idle; step++) {
    state.update(0.05, DEFINITION, EVENTS);
  }
  expect(state.action).toBe(WeaponAction.Idle);
}

function simulateHeldCombo(framesPerSecond: number): number {
  const state = new BattlefieldHammerActionState();
  state.setAttackHeld(true);
  state.requestSwing(0, 1, 0);
  const frameTime = 1 / framesPerSecond;
  for (let frame = 0; frame < framesPerSecond * 2; frame++) {
    if (state.canBufferNextSwing) {
      state.requestSwing(0, 1, 0);
    }
    state.update(frameTime, DEFINITION, EVENTS);
  }
  return state.attackSequenceId;
}
