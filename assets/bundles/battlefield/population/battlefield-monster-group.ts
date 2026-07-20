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
  type MutableBattlefieldAimTarget,
  type MutableBattlefieldProjectileHit,
} from './battlefield-monster-contracts';

const AIM_ASSIST_MAXIMUM_WORLD_DISTANCE = 19;
const AIM_ASSIST_MINIMUM_ALIGNMENT = Math.cos(24 / 180 * Math.PI);
const AUTO_LOCK_MINIMUM_ALIGNMENT = Math.cos(68 / 180 * Math.PI);

interface BattlefieldMonsterRuntime extends PlanarTargetPopulation, MonsterCombatPopulation,
PlanarMonsterHitPopulation {
  readonly count: number;
  update(deltaTime: number): void;
  dispose(): void;
}

interface MutablePlanarTargetQuery extends PlanarTargetQuery {
  originX: number;
  originY: number;
  directionX: number;
  directionY: number;
  maximumDistance: number;
  minimumAlignment: number;
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
export class BattlefieldMonsterGroup {
  private readonly population: BattlefieldMonsterRuntime;
  private readonly localTargetQuery: MutablePlanarTargetQuery = {
    originX: 0,
    originY: 0,
    directionX: 0,
    directionY: 1,
    maximumDistance: AIM_ASSIST_MAXIMUM_WORLD_DISTANCE,
    minimumAlignment: AIM_ASSIST_MINIMUM_ALIGNMENT,
  };
  private readonly localTargetResult: MutablePlanarTargetResult = {
    entityId: -1,
    x: 0,
    y: 0,
    elevation: 0,
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
  ) {
    const assembly = createMonsterAssembly(
      renderBatch,
      centerX,
      centerZ,
      count,
      spawnSeed,
      worldDiameter,
    );
    this.population = assembly.population;
  }

  /** 当前地图群体的怪物数量。 */
  public get count(): number {
    return this.population.count;
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
    this.population.update(deltaTime);
    return this.population.consumeAttackDamage();
  }

  /** 把战场世界方向转换到本群体局部平面并执行轻量辅助瞄准。 */
  public writeAimTarget(
    originX: number,
    originZ: number,
    directionX: number,
    directionZ: number,
    result: MutableBattlefieldAimTarget,
  ): boolean {
    return this.writeTarget(
      originX,
      originZ,
      directionX,
      directionZ,
      AIM_ASSIST_MINIMUM_ALIGNMENT,
      result,
    );
  }

  /** 在玩家移动朝向的宽锥体内执行自动锁定。 */
  public writeAutoTarget(
    originX: number,
    originZ: number,
    directionX: number,
    directionZ: number,
    result: MutableBattlefieldAimTarget,
  ): boolean {
    return this.writeTarget(
      originX,
      originZ,
      directionX,
      directionZ,
      AUTO_LOCK_MINIMUM_ALIGNMENT,
      result,
    );
  }

  /** 查询一段世界空间子弹位移最先接触的本群怪物。 */
  public writeProjectileHit(
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
    if (!this.population.findFirstPlanarHit(query, this.localHitResult)) {
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

  /** 把战场世界方向转换到本群体局部平面并执行指定角度的目标查询。 */
  private writeTarget(
    originX: number,
    originZ: number,
    directionX: number,
    directionZ: number,
    minimumAlignment: number,
    result: MutableBattlefieldAimTarget,
  ): boolean {
    if (this.disposed) {
      return false;
    }
    const config = BATTLEFIELD_MONSTER_SPAWN;
    const inverseScale = 1 / config.modelScale;
    const query = this.localTargetQuery;
    query.originX = originX * inverseScale;
    query.originY = -originZ * inverseScale;
    query.directionX = directionX;
    query.directionY = -directionZ;
    query.maximumDistance = AIM_ASSIST_MAXIMUM_WORLD_DISTANCE * inverseScale;
    query.minimumAlignment = minimumAlignment;
    if (!this.population.findBestPlanarTarget(query, this.localTargetResult)) {
      return false;
    }
    result.x = this.localTargetResult.x * config.modelScale;
    result.y = config.groundOffsetY
      + this.localTargetResult.elevation * config.modelScale;
    result.z = -this.localTargetResult.y * config.modelScale;
    return true;
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
    seed: config.seed ^ spawnSeed,
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
