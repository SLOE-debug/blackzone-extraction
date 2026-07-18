import { describe, expect, it } from 'vitest';
import { BUNDLE_MANIFEST } from '../../assets/core/bundles/bundle-manifest';
import { BundleId, SceneId } from '../../assets/core/contracts/runtime-id';
import { SCENE_MANIFEST } from '../../assets/core/scenes/scene-manifest';

describe('类型化独立场景清单', () => {
  it('将战场 Scene 固定映射到 Battlefield Asset Bundle', () => {
    const battlefield = SCENE_MANIFEST[SceneId.Battlefield];

    expect(battlefield.id).toBe(SceneId.Battlefield);
    expect(battlefield.assetName).toBe('battlefield');
    expect(battlefield.bundle).toBe(BUNDLE_MANIFEST[BundleId.Battlefield]);
  });
});
