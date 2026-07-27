import { describe, expect, it } from 'vitest';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { type PlanarCrowdPopulation } from '../../assets/core/monsters/crowd/planar-crowd-population';
import { PlanarCrowdSeparationSystem } from '../../assets/core/monsters/crowd/planar-crowd-separation-system';
import { BATTLEFIELD_MONSTER_SPAWN } from '../../assets/bundles/battlefield/model/battlefield-monster-spawn';
import {
  BattlefieldMonsterTargetRegistry,
  distanceSquaredToSegment,
  type MutableBattlefieldMeleeTarget,
} from '../../assets/bundles/battlefield/population/battlefield-monster-target-registry';
import { type BattlefieldMonsterTargetGroup } from '../../assets/bundles/battlefield/population/battlefield-monster-target-group';

describe('锤头 Swept Capsule 窄相位', () => {
  it('使用有限线段最近点并正确处理端点外目标', () => {
    expect(distanceSquaredToSegment(1, 0.5, 0, 0, 2, 0)).toBeCloseTo(0.25, 6);
    expect(distanceSquaredToSegment(3, 0, 0, 0, 2, 0)).toBeCloseTo(1, 6);
    expect(distanceSquaredToSegment(-1, 0, 0, 0, 2, 0)).toBeCloseTo(1, 6);
  });

  it('零长度扫掠退化为点距离', () => {
    expect(distanceSquaredToSegment(2, 3, 1, 1, 1, 1)).toBeCloseTo(5, 6);
  });

  it('自动锁敌过滤非存活槽位并优先维持指定目标', () => {
    const crowd = new PlanarCrowdSeparationSystem();
    const population = createTargetPopulation();
    crowd.register(population);
    crowd.rebuild();
    const registry = new BattlefieldMonsterTargetRegistry(crowd);
    registry.register(createTargetGroup(population));
    const result: MutableBattlefieldMeleeTarget = {
      populationId: -1,
      entityId: -1,
      x: 0,
      z: 0,
      distanceSquared: 0,
    };
    expect(registry.writeBestMeleeTarget(0, 0, 5, -1, -1, result)).toBe(true);
    expect(result.entityId).toBe(0);
    expect(registry.writeBestMeleeTarget(0, 0, 5, 8, 1, result)).toBe(true);
    expect(result.entityId).toBe(1);

    population.participation[1] = 0;
    crowd.rebuild();
    expect(registry.writeBestMeleeTarget(0, 0, 5, 8, 1, result)).toBe(true);
    expect(result.entityId).toBe(0);
  });
});

function createTargetPopulation(): PlanarCrowdPopulation {
  const scale = BATTLEFIELD_MONSTER_SPAWN.modelScale;
  return {
    populationId: 8,
    count: 3,
    lifecycle: Uint8Array.of(
      MonsterLifecycleState.Alive,
      MonsterLifecycleState.Alive,
      MonsterLifecycleState.Dying,
    ),
    participation: Uint8Array.of(1, 1, 1),
    previousX: Float32Array.of(2 / scale, 3 / scale, 1 / scale),
    previousY: Float32Array.of(0, 0, 0),
    x: Float32Array.of(2 / scale, 3 / scale, 1 / scale),
    y: Float32Array.of(0, 0, 0),
    radius: Float32Array.of(0.3 / scale, 0.3 / scale, 0.3 / scale),
    inverseMass: Float32Array.of(1, 1, 1),
  };
}

function createTargetGroup(
  crowdPopulation: PlanarCrowdPopulation,
): BattlefieldMonsterTargetGroup {
  return {
    populationId: crowdPopulation.populationId,
    crowdPopulation,
    knockbackResistanceScale: 1,
    airborneResistanceScale: 1,
    damageMonster: () => undefined,
    setAirborneEffect: () => false,
  };
}
