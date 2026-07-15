import { AssetManager, assetManager } from 'cc';
import { type BundleId } from '../contracts/runtime-id';
import { type BundleDescriptor } from './bundle-manifest';

/**
 * 统一管理 Asset Bundle 的缓存与并发加载，业务代码不得直接调用 loadBundle。
 */
export class BundleService {
  private readonly loaded = new Map<BundleId, AssetManager.Bundle>();
  private readonly pending = new Map<BundleId, Promise<AssetManager.Bundle>>();

  /**
   * 加载清单中声明的 Asset Bundle。
   *
   * @param descriptor Bundle 清单描述。
   * @returns 加载完成的 Cocos Bundle 实例。
   */
  public async load<TId extends BundleId>(
    descriptor: BundleDescriptor<TId>,
  ): Promise<AssetManager.Bundle> {
    const cached = this.loaded.get(descriptor.id) ?? assetManager.getBundle(descriptor.id);
    if (cached !== null && cached !== undefined) {
      this.loaded.set(descriptor.id, cached);
      return cached;
    }

    const existingRequest = this.pending.get(descriptor.id);
    if (existingRequest !== undefined) {
      return existingRequest;
    }

    const request = new Promise<AssetManager.Bundle>((resolve, reject) => {
      assetManager.loadBundle(descriptor.id, (error: Error | null, loadedBundle: AssetManager.Bundle) => {
        if (error !== null) {
          reject(error);
          return;
        }

        resolve(loadedBundle);
      });
    });

    this.pending.set(descriptor.id, request);

    try {
      const bundle = await request;
      this.loaded.set(descriptor.id, bundle);
      return bundle;
    } finally {
      this.pending.delete(descriptor.id);
    }
  }
}
