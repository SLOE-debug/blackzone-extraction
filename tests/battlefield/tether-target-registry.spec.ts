import { describe, expect, it } from 'vitest';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { PlanarCrowdSeparationSystem } from '../../assets/core/monsters/crowd/planar-crowd-separation-system';
import { type PlanarCrowdPopulation } from '../../assets/core/monsters/crowd/planar-crowd-population';
import { BATTLEFIELD_EQUIPMENT_LIBRARY } from '../../assets/bundles/battlefield/equipment/catalog/battlefield-equipment-catalog';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';
import { type BattlefieldArrowCombatTarget } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-arrow-query';
import { BattlefieldArrowState } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-arrow-state';
import { BattlefieldTetherHitBuffer } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-tether-hit-buffer';
import {
  BATTLEFIELD_TETHER_COLLISION_RADIUS,
  BATTLEFIELD_TETHER_WORLD_Y,
} from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-tether-config';
import { BattlefieldReturningBowRuntime } from '../../assets/bundles/battlefield/equipment/projectile/population/battlefield-returning-bow-runtime';
import { BattlefieldMonsterTargetRegistry } from '../../assets/bundles/battlefield/population/battlefield-monster-target-registry';

describe('战场弦网目标查询', () => {
  it('无序弦网命中缓冲按 O(1) 追加顺序保存目标', () => {
    const result = new BattlefieldTetherHitBuffer(3);
    result.include(1, 30, 3, 0);
    result.include(1, 10, 1, 0);
    result.include(1, 20, 2, 0);

    expect(result.entityId).toEqual(Uint32Array.of(30, 10, 20));
    expect(result.x).toEqual(Float32Array.of(3, 1, 2));
    expect(result.z).toEqual(Float32Array.of(0, 0, 0));
  });

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
    const result = new BattlefieldTetherHitBuffer();
    const lineY = BATTLEFIELD_TETHER_WORLD_Y;
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
    expect(query.startY).toBeCloseTo(BATTLEFIELD_TETHER_WORLD_Y);
    expect(query.endY).toBeCloseTo(BATTLEFIELD_TETHER_WORLD_Y);
    expect(result.x[0]).toBeCloseTo(0);
    expect(result.z[0]).toBeCloseTo(0);

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
    const result = new BattlefieldTetherHitBuffer();
    const lineY = BATTLEFIELD_TETHER_WORLD_Y;

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

  it('玩家 Y 偏离战场地面时仍通过真实 Registry 结算弦网伤害', () => {
    const population = createTallMonsterPopulation();
    const crowd = new PlanarCrowdSeparationSystem();
    crowd.register(population);
    crowd.rebuild();
    const registry = new BattlefieldMonsterTargetRegistry(crowd);
    let damageTaken = 0;
    registry.register({
      populationId: population.populationId,
      crowdPopulation: population,
      launchResponse: {
        launchable: true,
        heightScale: 1,
        horizontalScale: 1,
        knockbackScale: 1,
      },
      damageMonster: (_entityId, amount) => {
        damageTaken += amount;
      },
      setAirborneEffect: () => false,
    });
    const bow = new BattlefieldReturningBowRuntime(
      BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.ReturningBow),
      createRegistryCombatTarget(registry),
    );
    bow.arrows.state[0] = BattlefieldArrowState.EmbeddedInWorld;
    bow.arrows.positionX[0] = -2;
    bow.arrows.positionZ[0] = 0;
    bow.arrows.state[1] = BattlefieldArrowState.EmbeddedInWorld;
    bow.arrows.positionX[1] = 2;
    bow.arrows.positionZ[1] = 0;

    expect(bow.requestTether()).toBe(true);
    bow.update(0.05, {
      entityId: 7,
      positionX: 0,
      positionY: 8,
      positionZ: 0,
      projectileOriginX: 0,
      projectileOriginY: 10,
      projectileOriginZ: 0,
      aimX: 0,
      aimZ: 1,
      alive: true,
    });

    expect(bow.damageEvents.count).toBe(1);
    expect(bow.resolveDamageEvents()).toBe(1);
    expect(damageTaken).toBeGreaterThan(0);
  });
});

/** 将真实 Registry 适配为弓运行时需要的完整战斗目标门面。 */
function createRegistryCombatTarget(
  registry: BattlefieldMonsterTargetRegistry,
): BattlefieldArrowCombatTarget {
  return {
    writeBestArrowAimTarget: (query, result) => registry.writeBestArrowAimTarget(query, result),
    collectArrowSweepHits: (query, result) => registry.collectArrowSweepHits(query, result),
    collectTetherOverlapHits: (query, result) => registry.collectTetherOverlapHits(query, result),
    writeArrowTargetPose: (populationId, entityId, result) => registry.writeArrowTargetPose(
      populationId,
      entityId,
      result,
    ),
    damageMonster: (populationId, entityId, amount) => registry.damageMonster(
      populationId,
      entityId,
      amount,
    ),
    applyArrowSlow: () => true,
    applyArrowPull: () => true,
  };
}

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
