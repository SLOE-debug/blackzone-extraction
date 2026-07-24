import { describe, expect, it } from 'vitest';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import {
  type MutablePlanarMonsterHitResult,
  type PlanarMonsterHitQuery,
} from '../../assets/core/contracts/monster-hit';
import { type PlanarCrowdPopulation } from '../../assets/core/monsters/crowd/planar-crowd-population';
import { PlanarCrowdSeparationSystem } from '../../assets/core/monsters/crowd/planar-crowd-separation-system';
import { WorldPhase } from '../../assets/core/world/world-phase';
import { BATTLEFIELD_EQUIPMENT_LIBRARY } from '../../assets/bundles/battlefield/equipment/catalog/battlefield-equipment-catalog';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';
import { MutableBattlefieldProjectileStatistics } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-projectile-statistics';
import { BattlefieldProjectileCombatPopulation } from '../../assets/bundles/battlefield/equipment/projectile/population/battlefield-projectile-combat-population';
import { BATTLEFIELD_MONSTER_SPAWN } from '../../assets/bundles/battlefield/model/battlefield-monster-spawn';
import {
  type MutableBattlefieldAimTarget,
  type MutableBattlefieldProjectileHit,
} from '../../assets/bundles/battlefield/population/battlefield-monster-contracts';
import { type BattlefieldMonsterTargetGroup } from '../../assets/bundles/battlefield/population/battlefield-monster-target-group';
import { BattlefieldMonsterTargetRegistry } from '../../assets/bundles/battlefield/population/battlefield-monster-target-registry';
import { BattlefieldProjectileIntegrationWorldSystem } from '../../assets/bundles/battlefield/world/systems/battlefield-projectile-integration-world-system';
import { BattlefieldWeaponWorldSystem } from '../../assets/bundles/battlefield/world/systems/battlefield-weapon-world-system';
import { calculateCurveCrawlerAimElevation } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-combat-volume';
import { CurveCrawlerState } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-state';
import { createCurveCrawlerCrowdPopulation } from '../../assets/bundles/common-monsters/entities/curve-crawler/population/curve-crawler-crowd-population';
import { CurveCrawlerProjectileHitSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/population/curve-crawler-projectile-hit-system';
import { VenomLobberState } from '../../assets/bundles/common-monsters/entities/venom-lobber/model/venom-lobber-state';
import { VenomLobberProjectileHitSystem } from '../../assets/bundles/common-monsters/entities/venom-lobber/population/venom-lobber-projectile-hit-system';
import {
  completeCurveCrawlerTestEmergence,
  createNormalizedCurveCrawlerTestOptions,
} from '../curve-crawler/state-test-fixture';

const WORLD_SCALE = BATTLEFIELD_MONSTER_SPAWN.modelScale;
const WORLD_GROUND = BATTLEFIELD_MONSTER_SPAWN.groundOffsetY;

describe('战场实体弹丸完整伤害链路', () => {
  it('武器生成位于 PreSimulation，先于 Simulation 弹丸积分', () => {
    const weapon = new BattlefieldWeaponWorldSystem();
    const integration = new BattlefieldProjectileIntegrationWorldSystem();
    expect(weapon.phase).toBe(WorldPhase.PreSimulation);
    expect(integration.phase).toBe(WorldPhase.Simulation);
    expect(weapon.phase).toBeLessThan(integration.phase);
  });

  it('真实弹丸人口经过 Crowd 与 Curve Crawler 窄相位后扣减生命', () => {
    const fixture = createCurveCrawlerChain([7]);
    const definition = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.DesertEagle);
    const statistics = new MutableBattlefieldProjectileStatistics();
    const projectiles = new BattlefieldProjectileCombatPopulation(definition, statistics);
    const initialHealth = fixture.health[0] ?? 0;

    projectiles.spawn(0, fixture.aimElevation, 0, 1, 0, 0);
    projectiles.integrate(0.05);
    projectiles.collide(fixture.registry);
    projectiles.resolveImpacts(fixture.registry);

    expect(fixture.health[0]).toBe(initialHealth - definition.damage);
    expect(statistics).toMatchObject({
      projectilesSpawned: 1,
      projectilesIntegrated: 1,
      broadPhaseCandidates: 1,
      narrowPhaseHits: 1,
      impactsQueued: 1,
      damageEventsApplied: 1,
    });
  });

  it('弹道穿过近端腿部可见轮廓时产生完整命中与伤害统计', () => {
    const fixture = createCurveCrawlerChain([7]);
    const definition = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.DesertEagle);
    const statistics = new MutableBattlefieldProjectileStatistics();
    const projectiles = new BattlefieldProjectileCombatPopulation(definition, statistics);
    const initialHealth = fixture.health[0] ?? 0;
    const localLateralOffset = 7;
    const localLegElevation = 0.3;

    projectiles.spawn(
      0,
      WORLD_GROUND + localLegElevation * WORLD_SCALE,
      -localLateralOffset * WORLD_SCALE,
      1,
      0,
      0,
    );
    projectiles.integrate(0.05);
    projectiles.collide(fixture.registry);
    projectiles.resolveImpacts(fixture.registry);

    expect(fixture.health[0]).toBe(initialHealth - definition.damage);
    expect(statistics).toMatchObject({
      projectilesSpawned: 1,
      projectilesIntegrated: 1,
      broadPhaseCandidates: 1,
      narrowPhaseHits: 1,
      impactsQueued: 1,
      damageEventsApplied: 1,
    });
  });

  it('横向移动的 Curve Crawler 由相对运动 CCD 命中', () => {
    const fixture = createCurveCrawlerChain([7]);
    fixture.state.data.transform.previousY[0] = 10;
    fixture.crowd.rebuild();
    const definition = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.DesertEagle);
    const statistics = new MutableBattlefieldProjectileStatistics();
    const projectiles = new BattlefieldProjectileCombatPopulation(definition, statistics);
    const initialHealth = fixture.health[0] ?? 0;

    projectiles.spawn(0, fixture.aimElevation, 0, 1, 0, 0);
    projectiles.integrate(0.05);
    projectiles.collide(fixture.registry);
    projectiles.resolveImpacts(fixture.registry);

    expect(fixture.health[0]).toBe(initialHealth - definition.damage);
    expect(statistics.narrowPhaseHits).toBe(1);
  });

  it('Venom Lobber 复合窄相位也通过同一人口和伤害路由', () => {
    const fixture = createVenomLobberChain(7);
    const definition = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.DesertEagle);
    const statistics = new MutableBattlefieldProjectileStatistics();
    const projectiles = new BattlefieldProjectileCombatPopulation(definition, statistics);
    const initialHealth = fixture.health[0] ?? 0;

    projectiles.spawn(0, fixture.aimElevation, 0, 1, 0, 0);
    projectiles.integrate(0.05);
    projectiles.collide(fixture.registry);
    projectiles.resolveImpacts(fixture.registry);

    expect(fixture.health[0]).toBe(initialHealth - definition.damage);
    expect(statistics.damageEventsApplied).toBe(1);
  });

  it.each([30, 60, 120])('%i FPS 下得到相同的 Curve Crawler 命中结果', (fps) => {
    const fixture = createCurveCrawlerChain([40]);
    const definition = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.DesertEagle);
    const statistics = new MutableBattlefieldProjectileStatistics();
    const projectiles = new BattlefieldProjectileCombatPopulation(definition, statistics);
    const initialHealth = fixture.health[0] ?? 0;
    projectiles.spawn(0, fixture.aimElevation, 0, 1, 0, 0);

    for (let frame = 0; frame < fps && statistics.damageEventsApplied === 0; frame++) {
      projectiles.integrate(1 / fps);
      projectiles.collide(fixture.registry);
      projectiles.resolveImpacts(fixture.registry);
    }

    expect(fixture.health[0]).toBe(initialHealth - definition.damage);
    expect(statistics.damageEventsApplied).toBe(1);
  });

  it('贯穿两只怪物时按命中顺序衰减伤害', () => {
    const fixture = createCurveCrawlerChain([12, 28]);
    const definition = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.Akm);
    const statistics = new MutableBattlefieldProjectileStatistics();
    const projectiles = new BattlefieldProjectileCombatPopulation(definition, statistics);
    const initialFirstHealth = fixture.health[0] ?? 0;
    const initialSecondHealth = fixture.health[1] ?? 0;
    projectiles.spawn(0, fixture.aimElevation, 0, 1, 0, 0);

    for (let frame = 0; frame < 6 && statistics.damageEventsApplied < 2; frame++) {
      projectiles.integrate(0.05);
      projectiles.collide(fixture.registry);
      projectiles.resolveImpacts(fixture.registry);
    }

    expect(fixture.health[0]).toBeCloseTo(initialFirstHealth - definition.damage, 5);
    expect(fixture.health[1]).toBeCloseTo(
      initialSecondHealth - definition.damage * definition.projectile.damageRetention,
      5,
    );
    expect(statistics.damageEventsApplied).toBe(2);
  });
});

interface ProjectileChainFixture<TState> {
  readonly state: TState;
  readonly crowd: PlanarCrowdSeparationSystem;
  readonly registry: BattlefieldMonsterTargetRegistry;
  readonly health: Float32Array;
  readonly aimElevation: number;
}

function createCurveCrawlerChain(localX: readonly number[]): ProjectileChainFixture<CurveCrawlerState> {
  const state = new CurveCrawlerState(createNormalizedCurveCrawlerTestOptions({
    count: localX.length,
    spawnArea: { centerX: 0, centerY: 0, width: 2, height: 2 },
    seed: 913,
  }));
  completeCurveCrawlerTestEmergence(state);
  state.data.transform.x.set(localX);
  state.data.transform.previousX.set(localX);
  state.data.transform.y.fill(0);
  state.data.transform.previousY.fill(0);
  state.data.transform.heading.fill(0);
  state.data.transform.headingCosine.fill(1);
  state.data.transform.headingSine.fill(0);
  state.data.morphology.bodyWidth.fill(4);
  state.data.morphology.bodyLength.fill(6);
  state.data.morphology.legLength.fill(10);
  state.data.morphology.legWidth.fill(0.8);
  state.data.animation.bodyPulse.fill(0);
  state.data.animation.crouchAmount.fill(0);
  state.data.animation.biteAmount.fill(0);
  state.data.animation.turnAmount.fill(0);
  const hitSystem = new CurveCrawlerProjectileHitSystem();
  const aimElevation = calculateCurveCrawlerAimElevation(4, 0, 0, 0);
  return createChainFixture(
    state,
    createCurveCrawlerCrowdPopulation(state, 10),
    state.data.vitality.health,
    aimElevation,
    (entityIndex, query, result) => hitSystem.findEntity(state, entityIndex, query, result),
  );
}

function createVenomLobberChain(localX: number): ProjectileChainFixture<VenomLobberState> {
  const state = new VenomLobberState({
    count: 1,
    initialPopulationCount: 1,
    spawnArea: Object.freeze({ centerX: localX, centerY: 0, width: 2, height: 2 }),
    seed: 719,
    surfaceMaterialTemplate: {} as never,
  });
  state.data.vitality.state[0] = MonsterLifecycleState.Alive;
  state.data.transform.x[0] = localX;
  state.data.transform.previousX[0] = localX;
  state.data.transform.y[0] = 0;
  state.data.transform.previousY[0] = 0;
  state.data.transform.heading[0] = 0;
  state.data.morphology.scale[0] = 1;
  const hitSystem = new VenomLobberProjectileHitSystem();
  const crowdPopulation: PlanarCrowdPopulation = {
    populationId: 11,
    count: state.count,
    lifecycle: state.data.vitality.state,
    previousX: state.data.transform.previousX,
    previousY: state.data.transform.previousY,
    x: state.data.transform.x,
    y: state.data.transform.y,
    radius: new Float32Array(state.count).fill(10),
    inverseMass: new Float32Array(state.count).fill(1),
  };
  return createChainFixture(
    state,
    crowdPopulation,
    state.data.vitality.health,
    2.55,
    (entityIndex, query, result) => hitSystem.findEntity(state, entityIndex, query, result),
  );
}

function createChainFixture<TState>(
  state: TState,
  crowdPopulation: PlanarCrowdPopulation,
  health: Float32Array,
  localAimElevation: number,
  findHit: (
    entityIndex: number,
    query: Readonly<PlanarMonsterHitQuery>,
    result: MutablePlanarMonsterHitResult,
  ) => boolean,
): ProjectileChainFixture<TState> {
  const group = new TestProjectileTargetGroup(
    crowdPopulation,
    health,
    findHit,
  );
  const crowd = new PlanarCrowdSeparationSystem();
  crowd.register(crowdPopulation);
  crowd.rebuild();
  const registry = new BattlefieldMonsterTargetRegistry(crowd);
  registry.register(group);
  return {
    state,
    crowd,
    registry,
    health,
    aimElevation: WORLD_GROUND + localAimElevation * WORLD_SCALE,
  };
}

class TestProjectileTargetGroup implements BattlefieldMonsterTargetGroup {
  public readonly populationId: number;
  private readonly localHit: MutablePlanarMonsterHitResult = {
    entityId: -1,
    x: 0,
    y: 0,
    elevation: 0,
    segmentProgress: 0,
  };
  private readonly localQuery: PlanarMonsterHitQuery & {
    startX: number;
    startY: number;
    startElevation: number;
    endX: number;
    endY: number;
    endElevation: number;
    impactRadius: number;
  } = {
    startX: 0,
    startY: 0,
    startElevation: 0,
    endX: 0,
    endY: 0,
    endElevation: 0,
    impactRadius: 0,
  };

  constructor(
    public readonly crowdPopulation: PlanarCrowdPopulation,
    private readonly health: Float32Array,
    private readonly findHit: (
      entityIndex: number,
      query: Readonly<PlanarMonsterHitQuery>,
      result: MutablePlanarMonsterHitResult,
    ) => boolean,
  ) {
    this.populationId = crowdPopulation.populationId;
  }

  public writeAimTargetForEntity(
    _entityIndex: number,
    _originX: number,
    _originZ: number,
    _directionX: number,
    _directionZ: number,
    _result: MutableBattlefieldAimTarget,
  ): boolean {
    return false;
  }

  public writeProjectileHitForEntity(
    entityIndex: number,
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
    impactRadius: number,
    result: MutableBattlefieldProjectileHit,
  ): boolean {
    const inverseScale = 1 / WORLD_SCALE;
    const query = this.localQuery;
    query.startX = startX * inverseScale;
    query.startY = -startZ * inverseScale;
    query.startElevation = (startY - WORLD_GROUND) * inverseScale;
    query.endX = endX * inverseScale;
    query.endY = -endZ * inverseScale;
    query.endElevation = (endY - WORLD_GROUND) * inverseScale;
    query.impactRadius = impactRadius * inverseScale;
    if (!this.findHit(entityIndex, query, this.localHit)) {
      return false;
    }
    result.entityId = this.localHit.entityId;
    result.x = this.localHit.x * WORLD_SCALE;
    result.y = WORLD_GROUND + this.localHit.elevation * WORLD_SCALE;
    result.z = -this.localHit.y * WORLD_SCALE;
    result.segmentProgress = this.localHit.segmentProgress;
    return true;
  }

  public damageMonster(entityId: number, amount: number): void {
    this.health[entityId] = Math.max(0, (this.health[entityId] ?? 0) - amount);
  }
}
