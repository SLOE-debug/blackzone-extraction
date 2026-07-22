import { type Material, Node } from 'cc';
import { type MonsterObservationPopulation } from '../../../core/contracts/monster-observation';
import { BundleId, FeatureId } from '../../../core/contracts/runtime-id';
import { type FeaturePlugin } from '../../../core/features/feature-plugin';
import {
  CurveCrawlerMotionProfile,
  CurveCrawlerPopulation,
  CurveCrawlerPopulationBatch,
  type CurveCrawlerDisplayOptions,
  type CurveCrawlerPopulationOptions,
} from '../entities/curve-crawler';
import { CurveCrawlerRenderer } from '../entities/curve-crawler/rendering/curve-crawler-renderer';
import { CommonMonsterId } from '../contracts/common-monster-id';
import {
  VenomLobberPopulation,
  type VenomLobberPopulationOptions,
} from '../entities/venom-lobber';

/** Common Monsters 怪物标识到创建参数的精确映射。 */
export interface CommonMonsterOptionsMap {
  readonly [CommonMonsterId.CurveCrawler]: CurveCrawlerPopulationOptions;
  readonly [CommonMonsterId.VenomLobber]: VenomLobberPopulationOptions;
}

/** Common Monsters 怪物标识到群体实例的精确映射。 */
export interface CommonMonsterPopulationMap {
  readonly [CommonMonsterId.CurveCrawler]: CurveCrawlerPopulation;
  readonly [CommonMonsterId.VenomLobber]: VenomLobberPopulation;
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
    options: Readonly<CurveCrawlerDisplayOptions>,
  ): MonsterObservationPopulation;

  /** 创建供多个独立群体共用单一 MeshRenderer 的批渲染门面。 */
  createCurveCrawlerBatch(
    parent: Node,
    surfaceMaterialTemplate: Material,
  ): CurveCrawlerPopulationBatch;

  /** 创建拥有抛物线毒弹、落点预警与催化酸池的 Venom Lobber 群体。 */
  createVenomLobber(
    parent: Node,
    options: Readonly<VenomLobberPopulationOptions>,
  ): VenomLobberPopulation;

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
    [CommonMonsterId.CurveCrawler]: (parent, options) => this.createCurveCrawler(
      parent,
      options,
    ),
    [CommonMonsterId.VenomLobber]: (parent, options) => this.createVenomLobber(
      parent,
      options,
    ),
  });

  public createCurveCrawler(
    parent: Node,
    options: Readonly<CurveCrawlerPopulationOptions>,
  ): CurveCrawlerPopulation {
    return new CurveCrawlerPopulation(
      options,
      CurveCrawlerMotionProfile.Autonomous,
      (state) => new CurveCrawlerRenderer(parent, state, options.surfaceMaterialTemplate),
    );
  }

  public createCurveCrawlerDisplay(
    parent: Node,
    options: Readonly<CurveCrawlerDisplayOptions>,
  ): MonsterObservationPopulation {
    return new CurveCrawlerPopulation(
      options,
      CurveCrawlerMotionProfile.ObservationDisplay,
      (state) => new CurveCrawlerRenderer(parent, state, options.surfaceMaterialTemplate),
    );
  }

  public createCurveCrawlerBatch(
    parent: Node,
    surfaceMaterialTemplate: Material,
  ): CurveCrawlerPopulationBatch {
    return new CurveCrawlerPopulationBatch(parent, surfaceMaterialTemplate);
  }

  public createVenomLobber(
    parent: Node,
    options: Readonly<VenomLobberPopulationOptions>,
  ): VenomLobberPopulation {
    return new VenomLobberPopulation(parent, options);
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
