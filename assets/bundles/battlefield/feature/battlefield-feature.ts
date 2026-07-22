import { type Material, Node, type Scene } from 'cc';
import {
  createLoadingProgress,
  type LoadingProgressReporter,
} from '../../../core/contracts/loading-progress';
import { BundleService } from '../../../core/bundles/bundle-service';
import { BundleId, FeatureId } from '../../../core/contracts/runtime-id';
import { FeatureLoader } from '../../../core/features/feature-loader';
import { type FeaturePlugin } from '../../../core/features/feature-plugin';
import { featureRegistry } from '../../../core/features/feature-registry';
import { BattlefieldSceneEntry } from '../scene/battlefield-scene-entry';
import { BattlefieldSceneRuntime } from '../scene/battlefield-scene-runtime';

/** 战场 Bundle 对主包暴露的稳定场景创建门面。 */
export interface BattlefieldFeature extends FeaturePlugin<FeatureId.Battlefield> {
  /** 加载战场依赖，并把完整运行时装配到尚未激活的独立 Scene。 */
  prepareScene(
    scene: Scene,
    surfaceMaterialTemplate: Material,
    reportProgress: LoadingProgressReporter,
  ): Promise<void>;
}

class BattlefieldFeatureImplementation implements BattlefieldFeature {
  public readonly id = FeatureId.Battlefield;
  public readonly bundle = BundleId.Battlefield;
  private readonly featureLoader = new FeatureLoader(new BundleService(), featureRegistry);

  public async prepareScene(
    scene: Scene,
    surfaceMaterialTemplate: Material,
    reportProgress: LoadingProgressReporter,
  ): Promise<void> {
    reportProgress(createLoadingProgress(0.18, '战场分包加载完成'));
    reportProgress(createLoadingProgress(0.32, '正在加载基础怪物分包'));
    const commonMonsters = await this.featureLoader.load(FeatureId.CommonMonsters);
    reportProgress(createLoadingProgress(0.58, '正在加载蜘蛛 GPU 形变 Effect'));
    const curveCrawlerGpuEffect = await commonMonsters.loadCurveCrawlerGpuEffect();
    reportProgress(createLoadingProgress(0.76, '正在生成玩家附近的怪物'));

    const sceneEntry = new Node('battlefield-entry');
    scene.addChild(sceneEntry);
    const runtime = new BattlefieldSceneRuntime(
      sceneEntry,
      scene,
      surfaceMaterialTemplate,
      curveCrawlerGpuEffect,
    );
    try {
      runtime.initialize(commonMonsters);
      sceneEntry.addComponent(BattlefieldSceneEntry).bind(runtime);
      reportProgress(createLoadingProgress(1, '战场准备完成'));
    } catch (error: unknown) {
      runtime.dispose();
      if (sceneEntry.isValid) {
        sceneEntry.destroy();
      }
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
