import { describe, expect, it } from 'vitest';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { type PlanarCrowdPopulation } from '../../assets/core/monsters/crowd/planar-crowd-population';
import { PlanarCrowdSeparationSystem } from '../../assets/core/monsters/crowd/planar-crowd-separation-system';
import { BATTLEFIELD_MONSTER_SPAWN } from '../../assets/bundles/battlefield/model/battlefield-monster-spawn';
import {
  MeleeTargetSwitchReason,
} from '../../assets/bundles/battlefield/combat/battlefield-melee-attack-direction';
import {
  BattlefieldMeleeTargetResolver,
  createMutableMeleeAttackDirection,
  type BattlefieldMeleeAttackDirectionRequest,
} from '../../assets/bundles/battlefield/combat/battlefield-melee-target-resolver';
import {
  shouldSwitchMeleeAttackDirection,
} from '../../assets/bundles/battlefield/population/battlefield-melee-attack-direction-score';
import { BattlefieldMonsterTargetRegistry } from '../../assets/bundles/battlefield/population/battlefield-monster-target-registry';
import { type BattlefieldMonsterTargetGroup } from '../../assets/bundles/battlefield/population/battlefield-monster-target-group';

describe('近战怪群方向规划与目标稳定', () => {
  it('撤退时仍会选择移动方向反侧的范围内怪物', () => {
    const fixture = new TargetFixture([{ x: 2, z: 2 }]);
    const resolver = new BattlefieldMeleeTargetResolver();
    const result = createMutableMeleeAttackDirection();
    resolver.observeMovement(-1, -1);

    resolver.writeBestAttackDirection(
      fixture.registry,
      createRequest(-Math.PI * 0.75),
      result,
    );

    expect(result.targeted).toBe(true);
    expect(result.anchorEntityId).toBe(0);
    expect(result.directionX).toBeGreaterThan(0);
    expect(result.directionZ).toBeGreaterThan(0);
  });

  it('首次攻击能够选择人物正后方的唯一怪物', () => {
    const fixture = new TargetFixture([{ x: 0, z: -2 }]);
    const resolver = new BattlefieldMeleeTargetResolver();
    const result = createMutableMeleeAttackDirection();

    resolver.writeBestAttackDirection(fixture.registry, createRequest(0), result);

    expect(result.targeted).toBe(true);
    expect(result.directionX).toBeCloseTo(0, 5);
    expect(result.directionZ).toBeLessThan(-0.999);
  });

  it('四只稍远怪物组成的方向优先于单只近身怪物', () => {
    const fixture = new TargetFixture([
      { x: 0, z: 1.4 },
      { x: -0.6, z: -3 },
      { x: -0.2, z: -3.1 },
      { x: 0.2, z: -3.1 },
      { x: 0.6, z: -3 },
    ]);
    const resolver = new BattlefieldMeleeTargetResolver();
    const result = createMutableMeleeAttackDirection();

    resolver.writeBestAttackDirection(fixture.registry, createRequest(0), result);

    expect(result.targeted).toBe(true);
    expect(result.expectedHitCount).toBe(4);
    expect(result.directionZ).toBeLessThan(0);
    expect(result.anchorEntityId).not.toBe(0);
  });

  it('按住攻击且目标仍在释放半径内时保留稳定目标', () => {
    const fixture = new TargetFixture([{ x: 0, z: 4.8 }]);
    const resolver = new BattlefieldMeleeTargetResolver();
    const result = createMutableMeleeAttackDirection();
    resolver.writeBestAttackDirection(fixture.registry, createRequest(0), result);
    expect(result.anchorEntityId).toBe(0);

    fixture.move(0, 0, -6.5);
    resolver.observeMovement(0, -1);
    resolver.writeBestAttackDirection(fixture.registry, createRequest(Math.PI, 0), result);

    expect(result.targeted).toBe(true);
    expect(result.anchorEntityId).toBe(0);
    expect(result.targetRetained).toBe(true);
    expect(Math.abs(result.heading)).toBeGreaterThan(160 * Math.PI / 180);
  });

  it('松开攻击会立即清空稳定目标并记录释放原因', () => {
    const fixture = new TargetFixture([{ x: 0, z: 2 }]);
    const resolver = new BattlefieldMeleeTargetResolver();
    const result = createMutableMeleeAttackDirection();
    resolver.writeBestAttackDirection(fixture.registry, createRequest(0), result);

    resolver.releaseTarget();

    expect(resolver.debugState.anchorEntityId).toBe(-1);
    expect(resolver.debugState.targetRetained).toBe(false);
    expect(resolver.debugState.targetSwitchReason).toBe(MeleeTargetSwitchReason.AttackReleased);
  });

  it('稳定目标死亡后在下一段切向侧后方怪群', () => {
    const fixture = new TargetFixture([
      { x: 0, z: 2 },
      { x: -0.6, z: -3, active: false },
      { x: 0, z: -3.1, active: false },
      { x: 0.6, z: -3, active: false },
    ]);
    const resolver = new BattlefieldMeleeTargetResolver();
    const result = createMutableMeleeAttackDirection();
    resolver.writeBestAttackDirection(fixture.registry, createRequest(0), result);
    expect(result.anchorEntityId).toBe(0);

    fixture.kill(0);
    fixture.activate(1);
    fixture.activate(2);
    fixture.activate(3);
    resolver.writeBestAttackDirection(fixture.registry, createRequest(0, 0), result);

    expect(result.targeted).toBe(true);
    expect(result.anchorEntityId).not.toBe(0);
    expect(result.directionZ).toBeLessThan(0);
    expect(Math.abs(result.heading)).toBeGreaterThan(100 * Math.PI / 180);
    expect(Math.abs(result.heading)).toBeLessThanOrEqual(160 * Math.PI / 180 + 0.000001);
    expect(result.targetSwitchReason).toBe(MeleeTargetSwitchReason.PreferredInvalid);
  });

  it('小幅增益保留当前目标，明显更高价值的怪群才触发切换', () => {
    const fixture = new TargetFixture([
      { x: 0, z: 2 },
      { x: 1.2, z: -2.7, active: false },
      { x: 1.5, z: -2.6, active: false },
      { x: 1.5, z: -2.9, active: false },
      { x: 1.8, z: -2.7, active: false },
    ]);
    const resolver = new BattlefieldMeleeTargetResolver();
    const result = createMutableMeleeAttackDirection();
    resolver.writeBestAttackDirection(fixture.registry, createRequest(0), result);

    fixture.activate(1);
    fixture.activate(2);
    resolver.writeBestAttackDirection(fixture.registry, createRequest(0, 0), result);
    expect(result.anchorEntityId).toBe(0);
    expect(result.targetRetained).toBe(true);

    fixture.activate(3);
    fixture.activate(4);
    resolver.writeBestAttackDirection(fixture.registry, createRequest(0, 0), result);
    expect(result.anchorEntityId).not.toBe(0);
    expect(Math.abs(result.heading)).toBeLessThanOrEqual(100 * Math.PI / 180 + 0.000001);
    expect(result.targetSwitchReason).toBe(MeleeTargetSwitchReason.BetterCluster);
  });

  it('切换迟滞按百分之一百二十分数阈值判断', () => {
    expect(shouldSwitchMeleeAttackDirection(40, 44, 1)).toBe(false);
    expect(shouldSwitchMeleeAttackDirection(40, 52, 1)).toBe(true);
    expect(shouldSwitchMeleeAttackDirection(40, 1, 0)).toBe(true);
  });

  it('目标越过释放半径后立即允许选择新怪群', () => {
    const fixture = new TargetFixture([
      { x: 0, z: 4.8 },
      { x: -3, z: 0, active: false },
    ]);
    const resolver = new BattlefieldMeleeTargetResolver();
    const result = createMutableMeleeAttackDirection();
    resolver.writeBestAttackDirection(fixture.registry, createRequest(0), result);
    expect(result.anchorEntityId).toBe(0);

    fixture.move(0, 0, 7.2);
    fixture.activate(1);
    resolver.writeBestAttackDirection(fixture.registry, createRequest(0, 0), result);

    expect(result.anchorEntityId).toBe(1);
    expect(result.targetSwitchReason).toBe(MeleeTargetSwitchReason.PreferredOutOfRange);
  });

  it('无目标时优先使用最近战斗方向并忽略当前移动方向', () => {
    const fixture = new TargetFixture([{ x: 20, z: 20, active: false }]);
    const resolver = new BattlefieldMeleeTargetResolver();
    const result = createMutableMeleeAttackDirection();
    resolver.observeMovement(-1, 0);

    resolver.writeBestAttackDirection(fixture.registry, createRequest(Math.PI * 0.5), result);
    expect(result.directionX).toBeCloseTo(1, 6);
    expect(result.directionZ).toBeCloseTo(0, 6);

    resolver.observeMovement(0, -1);
    resolver.writeBestAttackDirection(fixture.registry, createRequest(0), result);
    expect(result.directionX).toBeCloseTo(1, 6);
    expect(result.directionZ).toBeCloseTo(0, 6);
    expect(result.targetSwitchReason).toBe(MeleeTargetSwitchReason.NoTargetFallback);
  });
});

interface TestTarget {
  readonly x: number;
  readonly z: number;
  readonly radius?: number;
  readonly active?: boolean;
}

class TargetFixture {
  public readonly registry: BattlefieldMonsterTargetRegistry;
  private readonly crowd: PlanarCrowdSeparationSystem;
  private readonly population: PlanarCrowdPopulation;

  constructor(targets: readonly TestTarget[]) {
    this.population = createPopulation(targets);
    this.crowd = new PlanarCrowdSeparationSystem();
    this.crowd.register(this.population);
    this.crowd.rebuild();
    this.registry = new BattlefieldMonsterTargetRegistry(this.crowd);
    this.registry.register(createTargetGroup(this.population));
  }

  public activate(entityId: number): void {
    this.population.lifecycle[entityId] = MonsterLifecycleState.Alive;
    this.population.participation[entityId] = 1;
    this.crowd.rebuild();
  }

  public kill(entityId: number): void {
    this.population.lifecycle[entityId] = MonsterLifecycleState.Dying;
    this.crowd.rebuild();
  }

  public move(entityId: number, x: number, z: number): void {
    const scale = BATTLEFIELD_MONSTER_SPAWN.modelScale;
    this.population.x[entityId] = x / scale;
    this.population.y[entityId] = -z / scale;
    this.population.previousX[entityId] = x / scale;
    this.population.previousY[entityId] = -z / scale;
    this.crowd.rebuild();
  }
}

function createRequest(
  currentHeading: number,
  previousAttackHeading: number | null = null,
): BattlefieldMeleeAttackDirectionRequest {
  return {
    originX: 0,
    originZ: 0,
    acquireRadius: 5,
    attackReach: 3.9,
    attackArcRadians: Math.PI * 0.74,
    currentHeading,
    previousAttackHeading,
  };
}

function createPopulation(targets: readonly TestTarget[]): PlanarCrowdPopulation {
  const scale = BATTLEFIELD_MONSTER_SPAWN.modelScale;
  const count = targets.length;
  const lifecycle = new Uint8Array(count);
  const participation = new Uint8Array(count);
  const previousX = new Float32Array(count);
  const previousY = new Float32Array(count);
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const radius = new Float32Array(count);
  const inverseMass = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    const target = targets[index]!;
    const active = target.active !== false;
    lifecycle[index] = active ? MonsterLifecycleState.Alive : MonsterLifecycleState.Dormant;
    participation[index] = active ? 1 : 0;
    x[index] = target.x / scale;
    y[index] = -target.z / scale;
    previousX[index] = x[index] ?? 0;
    previousY[index] = y[index] ?? 0;
    radius[index] = (target.radius ?? 0.3) / scale;
    inverseMass[index] = 1;
  }
  return {
    populationId: 9,
    count,
    lifecycle,
    participation,
    previousX,
    previousY,
    x,
    y,
    radius,
    inverseMass,
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
