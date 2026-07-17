import { BundleId } from '../contracts/runtime-id';

/**
 * 描述一个可由 BundleService 加载的 Asset Bundle。
 */
export interface BundleDescriptor<TId extends BundleId = BundleId> {
  readonly id: TId;
  readonly priority: number;
  readonly preload: boolean;
}

/** Asset Bundle 的唯一运行时清单。 */
export const BUNDLE_MANIFEST = Object.freeze({
  [BundleId.Battlefield]: Object.freeze({
    id: BundleId.Battlefield,
    priority: 20,
    preload: false,
  }),
  [BundleId.CommonMonsters]: Object.freeze({
    id: BundleId.CommonMonsters,
    priority: 10,
    preload: false,
  }),
}) satisfies Readonly<Record<BundleId, BundleDescriptor>>;
