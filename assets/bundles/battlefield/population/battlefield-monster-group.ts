import { FeatureId } from '../../../core/contracts/runtime-id';
import { type RegisteredFeaturePlugin } from '../../../core/features/feature-plugin';
import { BATTLEFIELD_COMBAT_CONFIG } from '../model/battlefield-combat-config';
import { BATTLEFIELD_MONSTER_SPAWN } from '../model/battlefield-monster-spawn';
import {
  type BattlefieldMonsterCombatTarget,
} from './battlefield-monster-contracts';
import { type BattlefieldMonsterTargetGroup } from './battlefield-monster-target-group';
import { type PlanarCrowdPopulation } from '../../../core/monsters/crowd/planar-crowd-population';
import {
  type BattlefieldMonsterRepopulationOptions,
  type BattlefieldMonsterRuntime,
  type MutablePlanarMonsterCombatTarget,
} from './battlefield-monster-group-contracts';
import { BattlefieldMonsterId } from '../model/battlefield-monster-id';
import { BATTLEFIELD_MONSTER_LAUNCH_RESPONSES } from '../model/battlefield-monster-launch-responses';

/** 保持一个地图随机怪物群的独立模拟，并接入战场共享怪物渲染批次。 */
export class BattlefieldMonsterGroup
implements BattlefieldMonsterTargetGroup {
  public readonly populationId: number;
  public readonly crowdPopulation: PlanarCrowdPopulation;
  public readonly launchResponse = BATTLEFIELD_MONSTER_LAUNCH_RESPONSES[
    BattlefieldMonsterId.CurveCrawler
  ];
  private readonly population: BattlefieldMonsterRuntime;
  private readonly localCombatTarget: MutablePlanarMonsterCombatTarget = {
    x: 0,
    y: 0,
    collisionRadius: 0,
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

  /** 把伤害路由到本群稳定实体标识。 */
  public damageMonster(entityId: number, amount: number): void {
    if (this.disposed) {
      return;
    }
    this.population.damage(entityId, amount);
  }

  /** 把世界腾空高度转换到 Curve Crawler 自身的正交高度轴。 */
  public setAirborneEffect(entityId: number, active: boolean, elevation: number): boolean {
    return !this.disposed && this.population.setAirborneEffect(
      entityId,
      active,
      elevation / BATTLEFIELD_MONSTER_SPAWN.modelScale,
    );
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
