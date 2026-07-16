import { Node } from 'cc';
import { type MonsterObservationPopulation } from '../../../core/contracts/monster-observation';
import { BundleId, FeatureId } from '../../../core/contracts/runtime-id';
import { type FeaturePlugin } from '../../../core/features/feature-plugin';
import {
  CurveCrawlerMotionProfile,
  CurveCrawlerPopulation,
  type CurveCrawlerPopulationOptions,
} from '../entities/curve-crawler';
import { CommonMonsterId } from '../contracts/common-monster-id';

/** Common Monsters 怪物标识到创建参数的精确映射。 */
export interface CommonMonsterOptionsMap {
  readonly [CommonMonsterId.CurveCrawler]: CurveCrawlerPopulationOptions;
}

/** Common Monsters 怪物标识到群体实例的精确映射。 */
export interface CommonMonsterPopulationMap {
  readonly [CommonMonsterId.CurveCrawler]: CurveCrawlerPopulation;
}

/**
 * Common Monsters Feature 对外提供的强类型怪物工厂。
 */
export interface CommonMonstersFeature extends FeaturePlugin<FeatureId.CommonMonsters> {
  /**
   * 创建 Curve Crawler 群体，供不静态依赖 Bundle 运行时枚举的主包调用。
   */
  createCurveCrawler(
    parent: Node,
    options: Readonly<CurveCrawlerPopulationOptions>,
  ): CurveCrawlerPopulation;

  /** 创建供场景陈列和观察窗使用的受控 Curve Crawler。 */
  createCurveCrawlerDisplay(
    parent: Node,
    options: Readonly<CurveCrawlerPopulationOptions>,
  ): MonsterObservationPopulation;

  /**
   * 按怪物标识创建与参数类型对应的群体实例。
   */
  create<TId extends CommonMonsterId>(
    id: TId,
    parent: Node,
    options: Readonly<CommonMonsterOptionsMap[TId]>,
  ): CommonMonsterPopulationMap[TId];
}

type CommonMonsterFactory<TId extends CommonMonsterId> = (
  parent: Node,
  options: Readonly<CommonMonsterOptionsMap[TId]>,
) => CommonMonsterPopulationMap[TId];

type CommonMonsterFactoryMap = {
  readonly [TId in CommonMonsterId]: CommonMonsterFactory<TId>;
};

class CommonMonstersFeatureImplementation implements CommonMonstersFeature {
  public readonly id = FeatureId.CommonMonsters;
  public readonly bundle = BundleId.CommonMonsters;

  private readonly factories: CommonMonsterFactoryMap = Object.freeze({
    [CommonMonsterId.CurveCrawler]: (parent, options) => new CurveCrawlerPopulation(
      parent,
      options,
      CurveCrawlerMotionProfile.Autonomous,
    ),
  });

  public createCurveCrawler(
    parent: Node,
    options: Readonly<CurveCrawlerPopulationOptions>,
  ): CurveCrawlerPopulation {
    return new CurveCrawlerPopulation(parent, options, CurveCrawlerMotionProfile.Autonomous);
  }

  public createCurveCrawlerDisplay(
    parent: Node,
    options: Readonly<CurveCrawlerPopulationOptions>,
  ): MonsterObservationPopulation {
    return new CurveCrawlerPopulation(
      parent,
      options,
      CurveCrawlerMotionProfile.ObservationDisplay,
    );
  }

  public create<TId extends CommonMonsterId>(
    id: TId,
    parent: Node,
    options: Readonly<CommonMonsterOptionsMap[TId]>,
  ): CommonMonsterPopulationMap[TId] {
    const factory = this.factories[id] as CommonMonsterFactory<TId>;
    return factory(parent, options);
  }
}

declare module '../../../core/features/feature-plugin' {
  interface FeaturePluginMap {
    readonly [FeatureId.CommonMonsters]: CommonMonstersFeature;
  }
}

/** Common Monsters Bundle 加载后注册的单例 Feature。 */
export const commonMonstersFeature: CommonMonstersFeature = new CommonMonstersFeatureImplementation();
