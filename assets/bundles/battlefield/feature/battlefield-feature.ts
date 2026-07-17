import { type Material, Node } from 'cc';
import {
  createLoadingProgress,
  type LoadingProgressReporter,
} from '../../../core/contracts/loading-progress';
import { type SceneRuntime } from '../../../core/contracts/scene-runtime';
import { BundleService } from '../../../core/bundles/bundle-service';
import { BundleId, FeatureId } from '../../../core/contracts/runtime-id';
import { FeatureLoader } from '../../../core/features/feature-loader';
import { type FeaturePlugin } from '../../../core/features/feature-plugin';
import { featureRegistry } from '../../../core/features/feature-registry';
import { BattlefieldSceneRuntime } from '../scene/battlefield-scene-runtime';

/** 战场 Bundle 对主包暴露的稳定场景创建门面。 */
export interface BattlefieldFeature extends FeaturePlugin<FeatureId.Battlefield> {
  /** 加载战场依赖并返回已经完成初始化的运行时场景。 */
  createSceneRuntime(
    sceneEntry: Node,
    surfaceMaterialTemplate: Material,
    reportProgress: LoadingProgressReporter,
  ): Promise<SceneRuntime>;
}

class BattlefieldFeatureImplementation implements BattlefieldFeature {
  public readonly id = FeatureId.Battlefield;
  public readonly bundle = BundleId.Battlefield;
  private readonly featureLoader = new FeatureLoader(new BundleService(), featureRegistry);

  public async createSceneRuntime(
    sceneEntry: Node,
    surfaceMaterialTemplate: Material,
    reportProgress: LoadingProgressReporter,
  ): Promise<SceneRuntime> {
    reportProgress(createLoadingProgress(0.18, '战场分包加载完成'));
    reportProgress(createLoadingProgress(0.32, '正在加载基础怪物分包'));
    const commonMonsters = await this.featureLoader.load(FeatureId.CommonMonsters);
    reportProgress(createLoadingProgress(0.76, '正在生成玩家附近的怪物'));

    const runtime = new BattlefieldSceneRuntime(sceneEntry, surfaceMaterialTemplate);
    try {
      runtime.initialize(commonMonsters);
      reportProgress(createLoadingProgress(1, '战场准备完成'));
      return runtime;
    } catch (error: unknown) {
      runtime.dispose();
      throw error;
    }
  }
}

declare module '../../../core/features/feature-plugin' {
  interface FeaturePluginMap {
    readonly [FeatureId.Battlefield]: BattlefieldFeature;
  }
}

/** Battlefield Bundle 加载后注册的单例 Feature。 */
export const battlefieldFeature: BattlefieldFeature = new BattlefieldFeatureImplementation();
