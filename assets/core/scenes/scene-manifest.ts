import { BUNDLE_MANIFEST, type BundleDescriptor } from '../bundles/bundle-manifest';
import { BundleId, SceneId } from '../contracts/runtime-id';

/** 描述一个位于类型化 Asset Bundle 内的独立 Cocos Scene。 */
export interface SceneDescriptor<TId extends SceneId = SceneId> {
  readonly id: TId;
  readonly bundle: BundleDescriptor;
  readonly assetName: string;
}

/** 独立 Scene 标识、所属 Bundle 和资源名称的唯一清单。 */
export const SCENE_MANIFEST = Object.freeze({
  [SceneId.Lobby]: Object.freeze({
    id: SceneId.Lobby,
    bundle: BUNDLE_MANIFEST[BundleId.Main],
    assetName: 'lobby',
  }),
  [SceneId.Battlefield]: Object.freeze({
    id: SceneId.Battlefield,
    bundle: BUNDLE_MANIFEST[BundleId.Battlefield],
    assetName: 'battlefield',
  }),
}) satisfies Readonly<Record<SceneId, SceneDescriptor>>;
