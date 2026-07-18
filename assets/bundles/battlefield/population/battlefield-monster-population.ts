import { type Material, Node } from 'cc';
import {
  type MutablePlanarTargetResult,
  type PlanarTargetPopulation,
  type PlanarTargetQuery,
} from '../../../core/contracts/planar-target';
import { type RegisteredFeaturePlugin } from '../../../core/features/feature-plugin';
import { FeatureId } from '../../../core/contracts/runtime-id';
import { BATTLEFIELD_MONSTER_SPAWN } from '../model/battlefield-monster-spawn';

const AIM_ASSIST_MAXIMUM_WORLD_DISTANCE = 19;
const AIM_ASSIST_MINIMUM_ALIGNMENT = Math.cos(24 / 180 * Math.PI);

interface BattlefieldMonsterRuntime extends PlanarTargetPopulation {
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

/** 战场世界 XZ 平面中复用的瞄准吸附结果。 */
export interface MutableBattlefieldAimTarget {
  entityId: number;
  x: number;
  z: number;
}

/** 将 Common Monsters 的二维本地群体装配到战场 XZ 地面。 */
export class BattlefieldMonsterPopulation {
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
  private disposed = false;

  constructor(
    parent: Node,
    surfaceMaterialTemplate: Material,
    commonMonsters: RegisteredFeaturePlugin<FeatureId.CommonMonsters>,
  ) {
    const config = BATTLEFIELD_MONSTER_SPAWN;
    const modelRoot = new Node('BattlefieldCommonMonsters');
    parent.addChild(modelRoot);
    modelRoot.setPosition(config.center.x, config.center.y, config.center.z);
    // Curve Crawler 原生位于 XY 平面并以 Z 为高度；旋转后对齐世界 XZ 地面与 Y-up。
    modelRoot.setRotationFromEuler(-90, 0, 0);
    modelRoot.setScale(config.modelScale, config.modelScale, config.modelScale);
    this.modelRoot = modelRoot;

    try {
      const localDiameter = config.worldDiameter / config.modelScale;
      this.population = commonMonsters.createCurveCrawler(modelRoot, {
        count: config.count,
        spawnArea: Object.freeze({
          width: localDiameter,
          height: localDiameter,
        }),
        seed: config.seed,
        surfaceMaterialTemplate,
      });
    } catch (error: unknown) {
      modelRoot.destroy();
      throw error;
    }
  }

  /** 当前战场基础怪物数量。 */
  public get count(): number {
    return this.population.count;
  }

  /** 推进基础怪物行为、移动、动画和渲染。 */
  public update(deltaTime: number): void {
    if (!this.disposed) {
      this.population.update(deltaTime);
    }
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
    query.originX = (originX - config.center.x) * inverseScale;
    query.originY = -(originZ - config.center.z) * inverseScale;
    query.directionX = directionX;
    query.directionY = -directionZ;
    query.maximumDistance = AIM_ASSIST_MAXIMUM_WORLD_DISTANCE * inverseScale;
    if (!this.population.findBestPlanarTarget(query, this.localTargetResult)) {
      return false;
    }
    result.entityId = this.localTargetResult.entityId;
    result.x = config.center.x + this.localTargetResult.x * config.modelScale;
    result.z = config.center.z - this.localTargetResult.y * config.modelScale;
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
}
