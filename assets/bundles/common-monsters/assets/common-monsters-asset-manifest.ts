import {
  BUNDLE_MANIFEST,
  type BundleDescriptor,
} from '../../../core/bundles/bundle-manifest';
import { BundleId } from '../../../core/contracts/runtime-id';
import { CommonMonstersAssetId } from '../contracts/common-monsters-asset-id';

export interface CommonMonstersAssetDescriptor<
  TId extends CommonMonstersAssetId = CommonMonstersAssetId,
> {
  readonly id: TId;
  readonly bundle: BundleDescriptor<BundleId.CommonMonsters>;
  readonly path: string;
}

/** Common Monsters Bundle 运行时资源的类型化路径清单。 */
export const COMMON_MONSTERS_ASSET_MANIFEST = Object.freeze({
  [CommonMonstersAssetId.CurveCrawlerGpuEffect]: Object.freeze({
    id: CommonMonstersAssetId.CurveCrawlerGpuEffect,
    bundle: BUNDLE_MANIFEST[BundleId.CommonMonsters],
    path: 'effects/curve-crawler-gpu',
  }),
}) satisfies Readonly<Record<CommonMonstersAssetId, CommonMonstersAssetDescriptor>>;
