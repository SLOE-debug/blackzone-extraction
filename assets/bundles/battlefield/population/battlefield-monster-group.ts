import {
  type MonsterCombatPopulation,
  type PlanarMonsterCombatTarget,
} from '../../../core/contracts/monster-combat';
import {
  type MutablePlanarMonsterHitResult,
  type PlanarMonsterHitPopulation,
  type PlanarMonsterHitQuery,
} from '../../../core/contracts/monster-hit';
import {
  type MutablePlanarTargetResult,
  type PlanarTargetPopulation,
  type PlanarTargetQuery,
} from '../../../core/contracts/planar-target';
import { FeatureId } from '../../../core/contracts/runtime-id';
import { type RegisteredFeaturePlugin } from '../../../core/features/feature-plugin';
import { BATTLEFIELD_COMBAT_CONFIG } from '../model/battlefield-combat-config';
import { BATTLEFIELD_MONSTER_SPAWN } from '../model/battlefield-monster-spawn';
import {
  type BattlefieldMonsterCombatTarget,
  type MutableBattlefieldAimRayContact,
  type MutableBattlefieldProjectileHit,
} from './battlefield-monster-contracts';
import { type BattlefieldMonsterTargetGroup } from './battlefield-monster-target-group';
import { type PlanarCrowdPopulation } from '../../../core/monsters/crowd/planar-crowd-population';

interface BattlefieldMonsterRuntime extends PlanarTargetPopulation, MonsterCombatPopulation,
PlanarMonsterHitPopulation {
  readonly count: number;
  readonly aliveCount: number;
  maintainAround(options: Readonly<BattlefieldMonsterRepopulationOptions>): void;
  update(deltaTime: number): void;
  simulate(deltaTime: number): void;
  synchronizeRendering(): void;
  createCrowdPopulation(populationId: number): PlanarCrowdPopulation;
  findPlanarTarget(
    entityIndex: number,
    query: Readonly<PlanarTargetQuery>,
    result: MutablePlanarTargetResult,
  ): boolean;
  findPlanarHit(
    entityIndex: number,
    query: Readonly<PlanarMonsterHitQuery>,
    result: MutablePlanarMonsterHitResult,
  ): boolean;
  dispose(): void;
}

interface BattlefieldMonsterRepopulationOptions {
  centerX: number;
  centerY: number;
  spawnInnerRadius: number;
  spawnOuterRadius: number;
  recycleRadius: number;
  hardRecycleRadius: number;
  desiredPopulationCount: number;
}

interface MutablePlanarTargetQuery extends PlanarTargetQuery {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface MutablePlanarMonsterCombatTarget extends PlanarMonsterCombatTarget {
  x: number;
  y: number;
  collisionRadius: number;
}

interface MutablePlanarMonsterHitQuery extends PlanarMonsterHitQuery {
  startX: number;
  startY: number;
  startElevation: number;
  endX: number;
  endY: number;
  endElevation: number;
  impactRadius: number;
}

/** 保持一个地图随机怪物群的独立模拟，并接入战场共享怪物渲染批次。 */
export class BattlefieldMonsterGroup implements BattlefieldMonsterTargetGroup {
  public readonly populationId: number;
  public readonly crowdPopulation: PlanarCrowdPopulation;
  private readonly population: BattlefieldMonsterRuntime;
  private readonly localTargetQuery: MutablePlanarTargetQuery = {
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 1,
  };
  private readonly localTargetResult: MutablePlanarTargetResult = {
    entityId: -1,
    x: 0,
    y: 0,
    elevation: 0,
    segmentProgress: 0,
  };
  private readonly localCombatTarget: MutablePlanarMonsterCombatTarget = {
    x: 0,
    y: 0,
    collisionRadius: 0,
  };
  private readonly localHitQuery: MutablePlanarMonsterHitQuery = {
    startX: 0,
    startY: 0,
    startElevation: 0,
    endX: 0,
    endY: 0,
    endElevation: 0,
    impactRadius: 0,
  };
  private readonly localHitResult: MutablePlanarMonsterHitResult = {
    entityId: -1,
    x: 0,
    y: 0,
    elevation: 0,
    segmentProgress: 0,
  };
  private combatTargetActive = false;
  private readonly repopulationOptions: BattlefieldMonsterRepopulationOptions = {
    centerX: 0,
    centerY: 0,
    spawnInnerRadius: 1,
    spawnOuterRadius: 2,
    recycleRadius: 3,
    hardRecycleRadius: 4,
    desiredPopulationCount: 0,
  };
  private disposed = false;

  constructor(
    renderBatch: ReturnType<
      RegisteredFeaturePlugin<FeatureId.CommonMonsters>['createCurveCrawlerBatch']
    >,
    centerX: number,
    centerZ: number,
    count: number,
    spawnSeed: number,
    worldDiameter: number,
    initialPopulationCount: number,
    populationId: number,
  ) {
    if (!Number.isInteger(initialPopulationCount)
      || initialPopulationCount < 0
      || initialPopulationCount > count) {
      throw new Error('战场怪物群初始人口必须位于零到群体容量之间。');
    }
    const assembly = createMonsterAssembly(
      renderBatch,
      centerX,
      centerZ,
      count,
      spawnSeed,
      worldDiameter,
      initialPopulationCount,
    );
    this.population = assembly.population;
    this.populationId = populationId;
    this.crowdPopulation = this.population.createCrowdPopulation(populationId);
  }

  /** 当前地图群体的怪物数量。 */
  public get count(): number {
    return this.population.count;
  }

  /** 当前真正活着并能追击玩家的怪物数。 */
  public get aliveCount(): number {
    return this.population.aliveCount;
  }

  /** 以玩家世界坐标为环带中心回收远处怪物并同步期望驻留数量。 */
  public maintainAround(
    playerX: number,
    playerZ: number,
    desiredPopulationCount: number,
  ): void {
    if (this.disposed) {
      return;
    }
    this.writeRepopulationOptions(playerX, playerZ, desiredPopulationCount);
    this.population.maintainAround(this.repopulationOptions);
  }

  /** 同步玩家目标，推进群体并返回本帧命中的聚合伤害。 */
  public update(
    deltaTime: number,
    target: Readonly<BattlefieldMonsterCombatTarget> | null,
  ): number {
    if (this.disposed) {
      return 0;
    }
    if (target === null) {
      if (this.combatTargetActive) {
        this.population.clearCombatTarget();
        this.combatTargetActive = false;
      }
    } else {
      this.writeLocalCombatTarget(target);
      this.population.synchronizeCombatTarget(this.localCombatTarget);
      this.combatTargetActive = true;
    }
    this.population.simulate(deltaTime);
    return this.population.consumeAttackDamage();
  }

  /** 在世界级 Crowd 求解结束后提交最终姿态。 */
  public synchronizeRendering(): void {
    if (!this.disposed) {
      this.population.synchronizeRendering();
    }
  }

  /** 把世界 XZ 线段转换到本群体局部平面并查询实体轮廓首次接触。 */
  public writeAimRayContactForEntity(
    entityIndex: number,
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
    result: MutableBattlefieldAimRayContact,
  ): boolean {
    if (this.disposed) {
      return false;
    }
    const config = BATTLEFIELD_MONSTER_SPAWN;
    const query = this.localTargetQuery;
    query.startX = startX / config.modelScale;
    query.startY = -startZ / config.modelScale;
    query.endX = endX / config.modelScale;
    query.endY = -endZ / config.modelScale;
    if (!this.population.findPlanarTarget(entityIndex, query, this.localTargetResult)) {
      return false;
    }
    result.x = this.localTargetResult.x * config.modelScale;
    result.y = config.groundOffsetY
      + this.localTargetResult.elevation * config.modelScale;
    result.z = -this.localTargetResult.y * config.modelScale;
    result.segmentProgress = this.localTargetResult.segmentProgress;
    return true;
  }

  /** 查询一段世界空间子弹位移最先接触的本群怪物。 */
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
    if (this.disposed) {
      return false;
    }
    const config = BATTLEFIELD_MONSTER_SPAWN;
    const inverseScale = 1 / config.modelScale;
    const query = this.localHitQuery;
    query.startX = startX * inverseScale;
    query.startY = -startZ * inverseScale;
    query.startElevation = (startY - config.groundOffsetY) * inverseScale;
    query.endX = endX * inverseScale;
    query.endY = -endZ * inverseScale;
    query.endElevation = (endY - config.groundOffsetY) * inverseScale;
    query.impactRadius = impactRadius * inverseScale;
    if (!this.population.findPlanarHit(entityIndex, query, this.localHitResult)) {
      return false;
    }
    result.entityId = this.localHitResult.entityId;
    result.x = this.localHitResult.x * config.modelScale;
    result.y = config.groundOffsetY
      + this.localHitResult.elevation * config.modelScale;
    result.z = -this.localHitResult.y * config.modelScale;
    result.segmentProgress = this.localHitResult.segmentProgress;
    return true;
  }

  /** 把伤害路由到本群稳定实体标识。 */
  public damageMonster(entityId: number, amount: number): void {
    if (this.disposed) {
      return;
    }
    this.population.damage(entityId, amount);
  }

  /** 释放本群体状态及其在共享渲染批次中的连续区段。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.population.dispose();
  }

  private writeLocalCombatTarget(target: Readonly<BattlefieldMonsterCombatTarget>): void {
    if (!Number.isFinite(target.x)
      || !Number.isFinite(target.z)
      || !Number.isFinite(target.collisionRadius)
      || target.collisionRadius < 0) {
      throw new Error('战场怪物目标必须使用有限坐标和非负碰撞半径。');
    }
    const inverseScale = 1 / BATTLEFIELD_MONSTER_SPAWN.modelScale;
    this.localCombatTarget.x = target.x * inverseScale;
    this.localCombatTarget.y = -target.z * inverseScale;
    this.localCombatTarget.collisionRadius = target.collisionRadius * inverseScale;
  }

  /** 把战场 XZ 环带配置转换为 Curve Crawler 本地 XY 平面。 */
  private writeRepopulationOptions(
    playerX: number,
    playerZ: number,
    desiredPopulationCount: number,
  ): void {
    const config = BATTLEFIELD_MONSTER_SPAWN;
    const inverseScale = 1 / config.modelScale;
    this.repopulationOptions.centerX = playerX * inverseScale;
    this.repopulationOptions.centerY = -playerZ * inverseScale;
    this.repopulationOptions.spawnInnerRadius = config.spawnInnerRadius * inverseScale;
    this.repopulationOptions.spawnOuterRadius = config.spawnOuterRadius * inverseScale;
    this.repopulationOptions.recycleRadius = config.recycleRadius * inverseScale;
    this.repopulationOptions.hardRecycleRadius = config.hardRecycleRadius * inverseScale;
    this.repopulationOptions.desiredPopulationCount = desiredPopulationCount;
  }
}

interface BattlefieldMonsterAssembly {
  readonly population: BattlefieldMonsterRuntime;
}

/** 在指定地图坐标创建独立模拟状态，并登记到场景共享怪物批次。 */
function createMonsterAssembly(
  renderBatch: ReturnType<
    RegisteredFeaturePlugin<FeatureId.CommonMonsters>['createCurveCrawlerBatch']
  >,
  centerX: number,
  centerZ: number,
  count: number,
  spawnSeed: number,
  worldDiameter: number,
  initialPopulationCount: number,
): BattlefieldMonsterAssembly {
  const config = BATTLEFIELD_MONSTER_SPAWN;
  if (!Number.isFinite(worldDiameter) || worldDiameter <= 0) {
    throw new Error('战场怪物群生成直径必须是有限正数。');
  }
  const localDiameter = worldDiameter / config.modelScale;
  const combat = BATTLEFIELD_COMBAT_CONFIG.monster;
  const inverseScale = 1 / config.modelScale;
  const population = renderBatch.createCurveCrawler({
    count,
    spawnArea: Object.freeze({
      centerX: centerX * inverseScale,
      centerY: -centerZ * inverseScale,
      width: localDiameter,
      height: localDiameter,
    }),
    seed: spawnSeed,
    initialPopulationCount,
    combat: Object.freeze({
      detectionRadius: combat.detectionRadius * inverseScale,
      disengageRadius: combat.disengageRadius * inverseScale,
      attackReach: combat.attackReach * inverseScale,
      impactTolerance: combat.impactTolerance * inverseScale,
      pursuitSpeedMultiplier: combat.pursuitSpeedMultiplier,
      damage: combat.damage,
      biteTiming: combat.biteTiming,
    }),
  });
  return Object.freeze({ population });
}
