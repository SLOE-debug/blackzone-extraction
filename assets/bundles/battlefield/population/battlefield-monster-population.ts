import { type Material, Node } from 'cc';
import { type RegisteredFeaturePlugin } from '../../../core/features/feature-plugin';
import { FeatureId } from '../../../core/contracts/runtime-id';
import { BATTLEFIELD_MONSTER_SPAWN } from '../model/battlefield-monster-spawn';

interface BattlefieldMonsterRuntime {
  readonly count: number;
  update(deltaTime: number): void;
  dispose(): void;
}

/** 将 Common Monsters 的二维本地群体装配到战场 XZ 地面。 */
export class BattlefieldMonsterPopulation {
  private readonly modelRoot: Node;
  private readonly population: BattlefieldMonsterRuntime;
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
