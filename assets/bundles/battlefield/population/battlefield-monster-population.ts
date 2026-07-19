import { type Material, Node } from 'cc';
import {
  type MonsterCombatPopulation,
  type PlanarMonsterCombatTarget,
} from '../../../core/contracts/monster-combat';
import {
  type MutablePlanarTargetResult,
  type PlanarTargetPopulation,
  type PlanarTargetQuery,
} from '../../../core/contracts/planar-target';
import { type RegisteredFeaturePlugin } from '../../../core/features/feature-plugin';
import { FeatureId } from '../../../core/contracts/runtime-id';
import { BATTLEFIELD_COMBAT_CONFIG } from '../model/battlefield-combat-config';
import { BATTLEFIELD_MONSTER_SPAWN } from '../model/battlefield-monster-spawn';

const AIM_ASSIST_MAXIMUM_WORLD_DISTANCE = 19;
const AIM_ASSIST_MINIMUM_ALIGNMENT = Math.cos(24 / 180 * Math.PI);

interface BattlefieldMonsterRuntime extends PlanarTargetPopulation, MonsterCombatPopulation {
  readonly count: number;
  update(deltaTime: number): void;
  dispose(): void;
}

interface BattlefieldMonsterAssembly {
  readonly root: Node;
  readonly population: BattlefieldMonsterRuntime;
}

interface MutablePlanarTargetQuery extends PlanarTargetQuery {
  originX: number;
  originY: number;
  directionX: number;
  directionY: number;
  maximumDistance: number;
  minimumAlignment: number;
}

/** 战场世界 XZ 平面中可被怪物感知和攻击的目标。 */
export interface BattlefieldMonsterCombatTarget {
  readonly x: number;
  readonly z: number;
  readonly collisionRadius: number;
}

interface MutablePlanarMonsterCombatTarget extends PlanarMonsterCombatTarget {
  x: number;
  y: number;
  collisionRadius: number;
}

/** 战场世界 XZ 平面中复用的瞄准吸附结果。 */
export interface MutableBattlefieldAimTarget {
  entityId: number;
  x: number;
  z: number;
}

/** 将 Common Monsters 的二维本地群体装配到战场 XZ 地面。 */
export class BattlefieldMonsterPopulation {
  private modelRoot: Node;
  private population: BattlefieldMonsterRuntime;
  private centerX: number;
  private centerZ: number;
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
  };
  private readonly localCombatTarget: MutablePlanarMonsterCombatTarget = {
    x: 0,
    y: 0,
    collisionRadius: 0,
  };
  private combatTargetActive = false;
  private disposed = false;

  constructor(
    private readonly parent: Node,
    private readonly surfaceMaterialTemplate: Material,
    private readonly commonMonsters: RegisteredFeaturePlugin<FeatureId.CommonMonsters>,
  ) {
    const config = BATTLEFIELD_MONSTER_SPAWN;
    const assembly = this.createAssembly(config.center.x, config.center.z);
    this.modelRoot = assembly.root;
    this.population = assembly.population;
    this.centerX = config.center.x;
    this.centerZ = config.center.z;
  }

  /** 当前怪物群体所属密林巢穴的世界 X。 */
  public get nestX(): number {
    return this.centerX;
  }

  /** 当前怪物群体所属密林巢穴的世界 Z。 */
  public get nestZ(): number {
    return this.centerZ;
  }

  /** 当前战场基础怪物数量。 */
  public get count(): number {
    return this.population.count;
  }

  /**
   * 旧巢穴离开活动窗口后，在最近的新巢穴内部重建固定数量怪物。
   *
   * 新群体完整创建成功后才释放旧批次，避免切换失败破坏当前运行时。
   */
  public relocateToNest(x: number, z: number): void {
    if (this.disposed) {
      throw new Error('战场怪物群体已经释放。');
    }
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      throw new Error('怪物巢穴坐标必须是有限数值。');
    }
    if (Math.hypot(x - this.centerX, z - this.centerZ) <= 0.01) {
      return;
    }
    const next = this.createAssembly(x, z);
    const previousPopulation = this.population;
    const previousRoot = this.modelRoot;
    this.population = next.population;
    this.modelRoot = next.root;
    this.centerX = x;
    this.centerZ = z;
    previousPopulation.dispose();
    if (previousRoot.isValid) {
      previousRoot.destroy();
    }
  }

  /** 同步玩家目标，推进怪物群体并返回本帧全部有效啃咬伤害。 */
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

  /** 将战场世界方向转换到怪物局部平面并执行轻量辅助瞄准。 */
  public resolveAimTarget(
    originX: number,
    originZ: number,
    directionX: number,
    directionZ: number,
    result: MutableBattlefieldAimTarget,
  ): boolean {
    if (this.disposed) {
      return false;
    }
    const config = BATTLEFIELD_MONSTER_SPAWN;
    const inverseScale = 1 / config.modelScale;
    const query = this.localTargetQuery;
    query.originX = (originX - this.centerX) * inverseScale;
    query.originY = -(originZ - this.centerZ) * inverseScale;
    query.directionX = directionX;
    query.directionY = -directionZ;
    query.maximumDistance = AIM_ASSIST_MAXIMUM_WORLD_DISTANCE * inverseScale;
    if (!this.population.findBestPlanarTarget(query, this.localTargetResult)) {
      return false;
    }
    result.entityId = this.localTargetResult.entityId;
    result.x = this.centerX + this.localTargetResult.x * config.modelScale;
    result.z = this.centerZ - this.localTargetResult.y * config.modelScale;
    return true;
  }

  /** 释放怪物动态网格和坐标转换根节点。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.population.dispose();
    if (this.modelRoot.isValid) {
      this.modelRoot.destroy();
    }
    this.disposed = true;
  }

  /** 在指定巢穴中心创建一套独立坐标根和怪物批次。 */
  private createAssembly(centerX: number, centerZ: number): BattlefieldMonsterAssembly {
    const config = BATTLEFIELD_MONSTER_SPAWN;
    const modelRoot = new Node('BattlefieldCommonMonsters');
    this.parent.addChild(modelRoot);
    modelRoot.setPosition(centerX, config.center.y, centerZ);
    // Curve Crawler 原生位于 XY 平面并以 Z 为高度；旋转后对齐世界 XZ 地面与 Y-up。
    modelRoot.setRotationFromEuler(-90, 0, 0);
    modelRoot.setScale(config.modelScale, config.modelScale, config.modelScale);

    try {
      const localDiameter = config.worldDiameter / config.modelScale;
      const combat = BATTLEFIELD_COMBAT_CONFIG.monster;
      const inverseScale = 1 / config.modelScale;
      const population = this.commonMonsters.createCurveCrawler(modelRoot, {
        count: config.count,
        spawnArea: Object.freeze({
          width: localDiameter,
          height: localDiameter,
        }),
        seed: config.seed ^ Math.imul(Math.trunc(centerX * 10), 0x45d9f3b)
          ^ Math.imul(Math.trunc(centerZ * 10), 0x119de1f3),
        surfaceMaterialTemplate: this.surfaceMaterialTemplate,
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
      return Object.freeze({ root: modelRoot, population });
    } catch (error: unknown) {
      modelRoot.destroy();
      throw error;
    }
  }

  /** 将战场世界目标转换成 Curve Crawler 原生 XY 平面。 */
  private writeLocalCombatTarget(target: Readonly<BattlefieldMonsterCombatTarget>): void {
    if (!Number.isFinite(target.x)
      || !Number.isFinite(target.z)
      || !Number.isFinite(target.collisionRadius)
      || target.collisionRadius < 0) {
      throw new Error('战场怪物目标必须使用有限坐标和非负碰撞半径。');
    }
    const inverseScale = 1 / BATTLEFIELD_MONSTER_SPAWN.modelScale;
    this.localCombatTarget.x = (target.x - this.centerX) * inverseScale;
    this.localCombatTarget.y = -(target.z - this.centerZ) * inverseScale;
    this.localCombatTarget.collisionRadius = target.collisionRadius * inverseScale;
  }
}
