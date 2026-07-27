import { describe, expect, it } from 'vitest';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { type BattlefieldMonsterEffectRuntime } from '../../assets/bundles/battlefield/combat/effects/battlefield-monster-effect-runtime';
import {
  type BattlefieldMonsterEffectTestGroup,
  createMonsterEffectRuntime,
  createMonsterEffectTestGroup,
} from './monster-effects-test-fixture';

describe('怪物方向腾空落地伤害', () => {
  it('高位方向腾空只在真实落地时结算一次额外伤害', () => {
    const group = createMonsterEffectTestGroup(1, [0]);
    const { effects } = createMonsterEffectRuntime(20, group);
    applyDirectionalLaunch(effects, 1, 4.2, 90);

    effects.update(0.01);
    expect(group.damageEvents).toHaveLength(0);
    advanceUntilGrounded(effects, group);
    expect(group.damageEvents).toHaveLength(1);
    expect(group.damageEvents[0]?.amount).toBeGreaterThan(0);

    for (let frame = 0; frame < 20; frame++) {
      effects.update(0.01);
    }
    expect(group.damageEvents).toHaveLength(1);
  });

  it('最低可见腾空高度的撞击速度低于阈值时不造成落地伤害', () => {
    const group = createMonsterEffectTestGroup(2, [0]);
    const { effects } = createMonsterEffectRuntime(20, group);
    applyDirectionalLaunch(effects, 2, 0.1, 90);
    advanceUntilGrounded(effects, group);
    expect(group.damageEvents).toHaveLength(0);
  });

  it('四点二米腾空的落地伤害高于一米腾空', () => {
    const lowGroup = createMonsterEffectTestGroup(3, [0]);
    const highGroup = createMonsterEffectTestGroup(4, [0]);
    const { effects } = createMonsterEffectRuntime(20, lowGroup, highGroup);
    applyDirectionalLaunch(effects, 3, 1, 90);
    applyDirectionalLaunch(effects, 4, 4.2, 90);
    advanceUntilAllGrounded(effects, [lowGroup, highGroup]);
    expect(highGroup.damageEvents[0]?.amount).toBeGreaterThan(
      lowGroup.damageEvents[0]?.amount ?? 0,
    );
  });

  it('空中死亡会清空待结算伤害且不会在落地时伤害死亡实体', () => {
    const group = createMonsterEffectTestGroup(5, [0]);
    const { effects } = createMonsterEffectRuntime(20, group);
    applyDirectionalLaunch(effects, 5, 4.2, 90);
    effects.update(0.05);
    group.crowdPopulation.lifecycle[0] = MonsterLifecycleState.Dead;
    for (let frame = 0; frame < 100; frame++) {
      effects.update(0.05);
    }
    expect(group.damageEvents).toHaveLength(0);
    expect(group.airborne[0]).toBe(0);
  });

  it('空中反复被方向掀飞时保留最高基础伤害并最终只结算一次', () => {
    const group = createMonsterEffectTestGroup(6, [0]);
    const { effects } = createMonsterEffectRuntime(20, group);
    applyDirectionalLaunch(effects, 6, 4.2, 40);
    for (let frame = 0; frame < 10; frame++) {
      effects.update(0.01);
    }
    applyDirectionalLaunch(effects, 6, 4.2, 90);
    for (let frame = 0; frame < 10; frame++) {
      effects.update(0.01);
    }
    applyDirectionalLaunch(effects, 6, 4.2, 20);
    advanceUntilGrounded(effects, group);
    expect(group.damageEvents).toHaveLength(1);
    expect(group.damageEvents[0]?.amount).toBeGreaterThan(80);
  });
});

function applyDirectionalLaunch(
  effects: BattlefieldMonsterEffectRuntime,
  populationId: number,
  targetHeight: number,
  landingDamageBase: number,
): void {
  effects.applyDirectionalLaunch(populationId, 0, {
    directionX: 1,
    directionZ: 0,
    targetHeight,
    horizontalSpeed: 0,
    horizontalDrag: 0,
    gravityScale: 1,
    landingDamageBase,
  });
}

function advanceUntilGrounded(
  effects: BattlefieldMonsterEffectRuntime,
  group: BattlefieldMonsterEffectTestGroup,
): void {
  advanceUntilAllGrounded(effects, [group]);
}

function advanceUntilAllGrounded(
  effects: BattlefieldMonsterEffectRuntime,
  groups: readonly BattlefieldMonsterEffectTestGroup[],
): void {
  for (let frame = 0; frame < 300; frame++) {
    effects.update(0.01);
    if (groups.every((group) => (group.airborne[0] ?? 0) === 0) && frame > 0) {
      return;
    }
  }
  throw new Error('方向腾空测试未在预期时间内落地。');
}
