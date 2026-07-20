import { BundleId, FeatureId } from '../contracts/runtime-id';
import { BUNDLE_MANIFEST, type BundleDescriptor } from '../bundles/bundle-manifest';

/** 描述 Feature 与 Asset Bundle 之间的静态映射。 */
export interface FeatureManifestEntry<TId extends FeatureId = FeatureId> {
  readonly id: TId;
  readonly bundle: BundleDescriptor;
}

/** Feature 加载关系的唯一清单。 */
export const FEATURE_MANIFEST = Object.freeze({
  [FeatureId.Battlefield]: Object.freeze({
    id: FeatureId.Battlefield,
    bundle: BUNDLE_MANIFEST[BundleId.Battlefield],
  }),
  [FeatureId.CommonMonsters]: Object.freeze({
    id: FeatureId.CommonMonsters,
    bundle: BUNDLE_MANIFEST[BundleId.CommonMonsters],
  }),
}) satisfies Readonly<Record<FeatureId, FeatureManifestEntry>>;
