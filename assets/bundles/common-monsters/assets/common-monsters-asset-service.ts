import { EffectAsset } from 'cc';
import { BundleService } from '../../../core/bundles/bundle-service';
import { CommonMonstersAssetId } from '../contracts/common-monsters-asset-id';
import { COMMON_MONSTERS_ASSET_MANIFEST } from './common-monsters-asset-manifest';

/** 通过类型化清单加载 Common Monsters 的运行时 Effect 资源。 */
export class CommonMonstersAssetService {
  private readonly bundles = new BundleService();
  private curveCrawlerGpuEffect: EffectAsset | null = null;
  private pendingCurveCrawlerGpuEffect: Promise<EffectAsset> | null = null;

  public async loadCurveCrawlerGpuEffect(): Promise<EffectAsset> {
    if (this.curveCrawlerGpuEffect !== null) {
      return this.curveCrawlerGpuEffect;
    }
    if (this.pendingCurveCrawlerGpuEffect !== null) {
      return this.pendingCurveCrawlerGpuEffect;
    }
    const request = this.loadEffect();
    this.pendingCurveCrawlerGpuEffect = request;
    try {
      const effect = await request;
      this.curveCrawlerGpuEffect = effect;
      return effect;
    } finally {
      this.pendingCurveCrawlerGpuEffect = null;
    }
  }

  private async loadEffect(): Promise<EffectAsset> {
    const descriptor = COMMON_MONSTERS_ASSET_MANIFEST[
      CommonMonstersAssetId.CurveCrawlerGpuEffect
    ];
    const bundle = await this.bundles.load(descriptor.bundle);
    return new Promise<EffectAsset>((resolve, reject) => {
      bundle.load(descriptor.path, EffectAsset, (error, effect) => {
        if (error !== null && error !== undefined) {
          reject(error);
          return;
        }
        if (effect === null || effect === undefined) {
          reject(new Error(`Common Monsters Effect 加载完成但没有返回资源：${descriptor.id}`));
          return;
        }
        resolve(effect);
      });
    });
  }
}
