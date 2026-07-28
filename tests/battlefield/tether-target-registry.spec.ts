import { describe, expect, it } from 'vitest';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { PlanarCrowdSeparationSystem } from '../../assets/core/monsters/crowd/planar-crowd-separation-system';
import { type PlanarCrowdPopulation } from '../../assets/core/monsters/crowd/planar-crowd-population';
import { BattlefieldArrowHitBuffer } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-arrow-query';
import { BATTLEFIELD_TETHER_HEIGHT_OFFSET } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-tether-config';
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
      + BATTLEFIELD_TETHER_HEIGHT_OFFSET;
    const query = {
      startX: -1,
      startY: lineY,
      startZ: 0,
      endX: 1,
      endY: lineY,
      endZ: 0,
      radius: 0.12,
    } as const;

    expect(registry.collectTetherOverlapHits(query, result)).toBe(1);
    expect(result.y[0]).toBeCloseTo(lineY);

    population.elevation[0] = 2;
    expect(registry.collectTetherOverlapHits(query, result)).toBe(0);
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
