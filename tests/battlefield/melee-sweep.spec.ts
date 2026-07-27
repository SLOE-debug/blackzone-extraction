import { describe, expect, it } from 'vitest';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { type PlanarCrowdPopulation } from '../../assets/core/monsters/crowd/planar-crowd-population';
import { PlanarCrowdSeparationSystem } from '../../assets/core/monsters/crowd/planar-crowd-separation-system';
import { BATTLEFIELD_MONSTER_SPAWN } from '../../assets/bundles/battlefield/model/battlefield-monster-spawn';
import {
  BattlefieldMonsterTargetRegistry,
  distanceSquaredToSegment,
} from '../../assets/bundles/battlefield/population/battlefield-monster-target-registry';
import { type BattlefieldMonsterTargetGroup } from '../../assets/bundles/battlefield/population/battlefield-monster-target-group';
import {
  type BattlefieldMeleeAttackDirectionQuery,
} from '../../assets/bundles/battlefield/combat/battlefield-melee-attack-direction';
import { createMutableMeleeAttackDirection } from '../../assets/bundles/battlefield/combat/battlefield-melee-target-resolver';

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
    const result = createMutableMeleeAttackDirection();
    const query = createTargetQuery();
    expect(registry.writeBestMeleeAttackDirection(query, result)).toBe(true);
    expect(result.anchorEntityId).toBe(0);
    query.preferredPopulationId = 8;
    query.preferredEntityId = 1;
    expect(registry.writeBestMeleeAttackDirection(query, result)).toBe(true);
    expect(result.anchorEntityId).toBe(1);
    expect(result.targetRetained).toBe(true);

    population.participation[1] = 0;
    crowd.rebuild();
    expect(registry.writeBestMeleeAttackDirection(query, result)).toBe(true);
    expect(result.anchorEntityId).toBe(0);
  });
});

function createTargetQuery(): Mutable<BattlefieldMeleeAttackDirectionQuery> {
  return {
    originX: 0,
    originZ: 0,
    acquireRadius: 5,
    releaseRadius: 7,
    attackReach: 4,
    attackArcRadians: Math.PI * 0.74,
    closeThreatRadius: 2.4,
    currentHeading: Math.PI * 0.5,
    previousAttackHeading: null,
    preferredPopulationId: -1,
    preferredEntityId: -1,
    maximumTurnRadians: Math.PI,
  };
}

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

type Mutable<T> = { -readonly [TKey in keyof T]: T[TKey] };
