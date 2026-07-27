import { describe, expect, it } from 'vitest';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { PlanarKnockbackCombineMode } from '../../assets/core/contracts/monster-effects';
import { BattlefieldMonsterEffectRuntime } from '../../assets/bundles/battlefield/combat/effects/battlefield-monster-effect-runtime';
import { type BattlefieldMonsterTargetGroup } from '../../assets/bundles/battlefield/population/battlefield-monster-target-group';
import { BATTLEFIELD_MONSTER_SPAWN } from '../../assets/bundles/battlefield/model/battlefield-monster-spawn';

describe('怪物通用受力 Effect', () => {
  it('同一攻击序列对同一实体只接受一次', () => {
    const group = createGroup(1, [0]);
    const effects = new BattlefieldMonsterEffectRuntime(20);
    effects.register(group);
    expect(effects.acceptHitSequence(1, 0, 17)).toBe(true);
    expect(effects.acceptHitSequence(1, 0, 17)).toBe(false);
    expect(effects.acceptHitSequence(1, 0, 18)).toBe(true);
  });

  it('击退推进平面位置且腾空高度最终回落到零', () => {
    const group = createGroup(2, [0]);
    const effects = new BattlefieldMonsterEffectRuntime(20);
    effects.register(group);
    effects.applyKnockback(2, 0, {
      directionX: 1,
      directionZ: 0,
      initialSpeed: 8,
      remainingSeconds: 0.2,
      resistanceScale: 1,
      combineMode: PlanarKnockbackCombineMode.Replace,
      maximumSpeed: 8,
    });
    effects.applyVerticalLaunch(2, 0, {
      initialVelocity: 5,
      gravityScale: 1,
      resistanceScale: 1,
    });
    effects.update(0.05);
    expect(group.crowdPopulation.x[0]).toBeGreaterThan(0);
    expect(group.elevations[0]).toBeGreaterThan(0);
    expect(group.airborne[0]).toBe(1);
    for (let frame = 0; frame < 30; frame++) {
      effects.update(0.05);
    }
    expect(group.elevations[0]).toBe(0);
    expect(group.airborne[0]).toBe(0);
  });

  it('方向腾空同时推进水平两轴并在落地时停止飞行', () => {
    const group = createGroup(4, [0]);
    const effects = new BattlefieldMonsterEffectRuntime(20);
    effects.register(group);
    effects.applyDirectionalLaunch(4, 0, {
      directionX: Math.SQRT1_2,
      directionZ: Math.SQRT1_2,
      horizontalSpeed: 9.2,
      verticalSpeed: 8,
      horizontalDrag: 1.15,
      gravityScale: 1,
      resistanceScale: 1,
    });
    effects.update(0.05);
    expect(group.crowdPopulation.x[0]).toBeGreaterThan(0);
    expect(group.crowdPopulation.y[0]).toBeLessThan(0);
    expect(group.elevations[0]).toBeGreaterThan(0);
    for (let frame = 0; frame < 40; frame++) {
      effects.update(0.05);
    }
    expect(group.airborne[0]).toBe(0);
  });

  it('旋风击退按速度向量累积、改变方向并受最大速度限制', () => {
    const group = createGroup(5, [0]);
    const effects = new BattlefieldMonsterEffectRuntime(20);
    effects.register(group);
    const apply = (directionX: number, directionZ: number, initialSpeed = 5): void => {
      effects.applyKnockback(5, 0, {
        directionX,
        directionZ,
        initialSpeed,
        remainingSeconds: 1,
        resistanceScale: 1,
        combineMode: PlanarKnockbackCombineMode.Accumulate,
        maximumSpeed: 12,
      });
    };
    apply(1, 0);
    effects.update(0.01);
    const firstDistance = group.crowdPopulation.x[0] ?? 0;
    apply(1, 0);
    effects.update(0.01);
    const secondDistance = (group.crowdPopulation.x[0] ?? 0) - firstDistance;
    expect(secondDistance).toBeGreaterThan(firstDistance);
    apply(0, 1);
    effects.update(0.01);
    expect(group.crowdPopulation.y[0]).toBeLessThan(0);
    const beforeCap = group.crowdPopulation.x[0] ?? 0;
    apply(1, 0, 50);
    effects.update(0.01);
    expect((group.crowdPopulation.x[0] ?? 0) - beforeCap).toBeLessThanOrEqual(
      12 * 0.01 / BATTLEFIELD_MONSTER_SPAWN.modelScale,
    );
  });

  it('反方向累积击退先抵消当前速度而不是沿旧方向提速', () => {
    const group = createGroup(6, [0]);
    const effects = new BattlefieldMonsterEffectRuntime(20);
    effects.register(group);
    const common = {
      initialSpeed: 5,
      remainingSeconds: 1,
      resistanceScale: 1,
      combineMode: PlanarKnockbackCombineMode.Accumulate,
      maximumSpeed: 12,
    } as const;
    effects.applyKnockback(6, 0, { ...common, directionX: 1, directionZ: 0 });
    effects.applyKnockback(6, 0, { ...common, directionX: -1, directionZ: 0 });
    effects.update(0.05);
    expect(group.crowdPopulation.x[0]).toBeCloseTo(0, 6);
  });

  it('同次技能中的磁化实体碰撞只产生一次二次伤害', () => {
    const group = createGroup(3, [0, 0.5]);
    const effects = new BattlefieldMonsterEffectRuntime(20);
    effects.register(group);
    effects.applyMagnetized(3, 0, 9, 2);
    effects.applyMagnetized(3, 1, 9, 2);
    effects.update(0);
    effects.update(0);
    expect(group.damageEvents).toEqual([0, 1]);
  });
});

function createGroup(populationId: number, positions: readonly number[]) {
  const count = positions.length;
  const lifecycle = new Uint8Array(count);
  lifecycle.fill(MonsterLifecycleState.Alive);
  const participation = new Uint8Array(count);
  participation.fill(1);
  const x = Float32Array.from(positions);
  const y = new Float32Array(count);
  const radius = new Float32Array(count);
  radius.fill(0.5);
  const inverseMass = new Float32Array(count);
  inverseMass.fill(1);
  const elevations = new Float32Array(count);
  const airborne = new Uint8Array(count);
  const damageEvents: number[] = [];
  return {
    populationId,
    knockbackResistanceScale: 1,
    airborneResistanceScale: 1,
    crowdPopulation: {
      populationId,
      count,
      lifecycle,
      participation,
      previousX: new Float32Array(count),
      previousY: new Float32Array(count),
      x,
      y,
      radius,
      inverseMass,
    },
    elevations,
    airborne,
    damageEvents,
    damageMonster(entityId: number) {
      damageEvents.push(entityId);
    },
    setAirborneEffect(entityId: number, active: boolean, elevation: number) {
      airborne[entityId] = active ? 1 : 0;
      elevations[entityId] = elevation;
      return true;
    },
  } satisfies BattlefieldMonsterTargetGroup & {
    readonly elevations: Float32Array;
    readonly airborne: Uint8Array;
    readonly damageEvents: number[];
  };
}
