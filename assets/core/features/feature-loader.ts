import { type BundleService } from '../bundles/bundle-service';
import { type RegisteredFeatureId, type RegisteredFeaturePlugin } from './feature-plugin';
import { type FeatureRegistry } from './feature-registry';
import { FEATURE_MANIFEST } from './feature-manifest';

/**
 * 按 Feature 清单加载对应 Bundle，并从注册表解析强类型 Feature。
 */
export class FeatureLoader {
  constructor(
    private readonly bundles: BundleService,
    private readonly registry: FeatureRegistry,
  ) {}

  /**
   * 加载并解析指定 Feature。
   *
   * @param id 已通过 FeaturePluginMap 声明的 Feature 标识。
   * @returns 与标识对应的精确 Feature 插件类型。
   */
  public async load<TId extends RegisteredFeatureId>(id: TId): Promise<RegisteredFeaturePlugin<TId>> {
    const manifest = FEATURE_MANIFEST[id];
    await this.bundles.load(manifest.bundle);
    return this.registry.get(id);
  }
}
