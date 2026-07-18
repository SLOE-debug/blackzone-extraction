import { director, type SceneAsset } from 'cc';
import { type BundleService } from '../bundles/bundle-service';
import { type SceneId } from '../contracts/runtime-id';
import { SCENE_MANIFEST } from './scene-manifest';

/** 统一负责从类型化 Bundle 加载并切换独立 Cocos Scene。 */
export class SceneService {
  constructor(private readonly bundles: BundleService) {}

  /** 加载 Scene 清单声明的场景资源，但不立即切换当前场景。 */
  public async load<TId extends SceneId>(id: TId): Promise<SceneAsset> {
    const descriptor = SCENE_MANIFEST[id];
    const bundle = await this.bundles.load(descriptor.bundle);
    return new Promise<SceneAsset>((resolve, reject) => {
      bundle.loadScene(descriptor.assetName, (error: Error | null, sceneAsset: SceneAsset) => {
        if (error !== null) {
          reject(error);
          return;
        }
        if (sceneAsset.scene === null) {
          reject(new Error(`场景资源没有有效 Scene：${descriptor.id}`));
          return;
        }
        resolve(sceneAsset);
      });
    });
  }

  /** 在当前帧结束时用已经准备完成的 SceneAsset 替换活动场景。 */
  public run(sceneAsset: SceneAsset): void {
    if (sceneAsset.scene === null) {
      throw new Error('不能切换到没有有效 Scene 的场景资源。');
    }
    director.runScene(sceneAsset);
  }
}
