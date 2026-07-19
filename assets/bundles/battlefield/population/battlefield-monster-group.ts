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
import { FeatureId } from '../../../core/contracts/runtime-id';
import { type RegisteredFeaturePlugin } from '../../../core/features/feature-plugin';
import { BATTLEFIELD_COMBAT_CONFIG } from '../model/battlefield-combat-config';
import { BATTLEFIELD_MONSTER_SPAWN } from '../model/battlefield-monster-spawn';
import {
  type BattlefieldMonsterCombatTarget,
  type MutableBattlefieldAimTarget,
} from './battlefield-monster-contracts';

const AIM_ASSIST_MAXIMUM_WORLD_DISTANCE = 19;
const AIM_ASSIST_MINIMUM_ALIGNMENT = Math.cos(24 / 180 * Math.PI);

interface BattlefieldMonsterRuntime extends PlanarTargetPopulation, MonsterCombatPopulation {
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

/** 把一个地图随机怪物群的本地二维坐标装配到战场 XZ 地面。 */
export class BattlefieldMonsterGroup {
  private readonly modelRoot: Node;
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
  };
  private readonly localCombatTarget: MutablePlanarMonsterCombatTarget = {
    x: 0,
    y: 0,
    collisionRadius: 0,
  };
  private combatTargetActive = false;
  private disposed = false;

  constructor(
    parent: Node,
    surfaceMaterialTemplate: Material,
    commonMonsters: RegisteredFeaturePlugin<FeatureId.CommonMonsters>,
    public readonly centerX: number,
    public readonly centerZ: number,
    count: number,
    spawnSeed: number,
    worldDiameter: number,
  ) {
    const assembly = createMonsterAssembly(
      parent,
      surfaceMaterialTemplate,
      commonMonsters,
      centerX,
      centerZ,
      count,
      spawnSeed,
      worldDiameter,
    );
    this.modelRoot = assembly.root;
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
    result.x = this.centerX + this.localTargetResult.x * config.modelScale;
    result.z = this.centerZ - this.localTargetResult.y * config.modelScale;
    return true;
  }

  /** 释放本群体的怪物动态网格和坐标根节点。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.population.dispose();
    if (this.modelRoot.isValid) {
      this.modelRoot.destroy();
    }
  }

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

interface BattlefieldMonsterAssembly {
  readonly root: Node;
  readonly population: BattlefieldMonsterRuntime;
}

/** 在指定地图坐标创建一套独立坐标根和怪物批次。 */
function createMonsterAssembly(
  parent: Node,
  surfaceMaterialTemplate: Material,
  commonMonsters: RegisteredFeaturePlugin<FeatureId.CommonMonsters>,
  centerX: number,
  centerZ: number,
  count: number,
  spawnSeed: number,
  worldDiameter: number,
): BattlefieldMonsterAssembly {
  const config = BATTLEFIELD_MONSTER_SPAWN;
  const modelRoot = new Node('BattlefieldCommonMonsters');
  parent.addChild(modelRoot);
  modelRoot.setPosition(centerX, config.groundOffsetY, centerZ);
  // Curve Crawler 原生位于 XY 平面并以 Z 为高度；旋转后对齐世界 XZ 地面与 Y-up。
  modelRoot.setRotationFromEuler(-90, 0, 0);
  modelRoot.setScale(config.modelScale, config.modelScale, config.modelScale);

  try {
    if (!Number.isFinite(worldDiameter) || worldDiameter <= 0) {
      throw new Error('战场怪物群生成直径必须是有限正数。');
    }
    const localDiameter = worldDiameter / config.modelScale;
    const combat = BATTLEFIELD_COMBAT_CONFIG.monster;
    const inverseScale = 1 / config.modelScale;
    const population = commonMonsters.createCurveCrawler(modelRoot, {
      count,
      spawnArea: Object.freeze({
        width: localDiameter,
        height: localDiameter,
      }),
      seed: config.seed ^ spawnSeed,
      surfaceMaterialTemplate,
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
