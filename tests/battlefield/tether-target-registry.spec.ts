import { describe, expect, it } from 'vitest';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { PlanarCrowdSeparationSystem } from '../../assets/core/monsters/crowd/planar-crowd-separation-system';
import { type PlanarCrowdPopulation } from '../../assets/core/monsters/crowd/planar-crowd-population';
import { BattlefieldArrowHitBuffer } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-arrow-query';
import {
  BATTLEFIELD_TETHER_COLLISION_RADIUS,
  BATTLEFIELD_TETHER_GROUND_HEIGHT,
} from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-tether-config';
import { BATTLEFIELD_MONSTER_SPAWN } from '../../assets/bundles/battlefield/model/battlefield-monster-spawn';
import { BattlefieldMonsterTargetRegistry } from '../../assets/bundles/battlefield/population/battlefield-monster-target-registry';

describe('战场弦网目标查询', () => {
  it('覆盖怪物脚底到身体顶部，并在怪物腾空后拒绝地面弦线', () => {
    const population = createTallMonsterPopulation();
    const crowd = new PlanarCrowdSeparationSystem();
    crowd.register(population);
    crowd.rebuild();
    const registry = new BattlefieldMonsterTargetRegistry(crowd);
    registry.register({
      populationId: population.populationId,
      crowdPopulation: population,
      launchResponse: {
        launchable: true,
        heightScale: 1,
        horizontalScale: 1,
        knockbackScale: 1,
      },
      damageMonster: () => undefined,
      setAirborneEffect: () => false,
    });
    const result = new BattlefieldArrowHitBuffer();
    const lineY = BATTLEFIELD_MONSTER_SPAWN.groundOffsetY
      + BATTLEFIELD_TETHER_GROUND_HEIGHT;
    const query = {
      startX: -1,
      startY: lineY,
      startZ: 0,
      endX: 1,
      endY: lineY,
      endZ: 0,
      radius: BATTLEFIELD_TETHER_COLLISION_RADIUS,
    } as const;

    expect(registry.collectTetherOverlapHits(query, result)).toBe(1);
    expect(result.y[0]).toBeCloseTo(lineY);

    population.elevation[0] = 3;
    expect(registry.collectTetherOverlapHits(query, result)).toBe(0);
  });

  it('真实 Crowd Population 中同一地面弦线返回全部五个重叠目标', () => {
    const population = createLineMonsterPopulation();
    const crowd = new PlanarCrowdSeparationSystem();
    crowd.register(population);
    crowd.rebuild();
    const registry = new BattlefieldMonsterTargetRegistry(crowd);
    registry.register({
      populationId: population.populationId,
      crowdPopulation: population,
      launchResponse: {
        launchable: true,
        heightScale: 1,
        horizontalScale: 1,
        knockbackScale: 1,
      },
      damageMonster: () => undefined,
      setAirborneEffect: () => false,
    });
    const result = new BattlefieldArrowHitBuffer();
    const lineY = BATTLEFIELD_MONSTER_SPAWN.groundOffsetY
      + BATTLEFIELD_TETHER_GROUND_HEIGHT;

    expect(registry.collectTetherOverlapHits({
      startX: -8,
      startY: lineY,
      startZ: 0,
      endX: 8,
      endY: lineY,
      endZ: 0,
      radius: BATTLEFIELD_TETHER_COLLISION_RADIUS,
    }, result)).toBe(5);
  });
});

/** 创建躯干胶囊明显高于脚底的单体 Crowd 测试数据。 */
function createTallMonsterPopulation(): PlanarCrowdPopulation {
  return {
    populationId: 17,
    count: 1,
    lifecycle: Uint8Array.of(MonsterLifecycleState.Alive),
    participation: Uint8Array.of(1),
    previousX: Float32Array.of(0),
    previousY: Float32Array.of(0),
    x: Float32Array.of(0),
    y: Float32Array.of(0),
    radius: Float32Array.of(3),
    centerHeight: Float32Array.of(8),
    halfHeight: Float32Array.of(2),
    elevation: Float32Array.of(0),
    inverseMass: Float32Array.of(1),
  };
}

/** 创建五只沿同一世界 X 轴排列的真实 Crowd 测试数据。 */
function createLineMonsterPopulation(): PlanarCrowdPopulation {
  const count = 5;
  return {
    populationId: 18,
    count,
    lifecycle: new Uint8Array(count).fill(MonsterLifecycleState.Alive),
    participation: new Uint8Array(count).fill(1),
    previousX: Float32Array.of(-40, -20, 0, 20, 40),
    previousY: new Float32Array(count),
    x: Float32Array.of(-40, -20, 0, 20, 40),
    y: new Float32Array(count),
    radius: new Float32Array(count).fill(3),
    centerHeight: new Float32Array(count).fill(8),
    halfHeight: new Float32Array(count).fill(2),
    elevation: new Float32Array(count),
    inverseMass: new Float32Array(count).fill(1),
  };
}
