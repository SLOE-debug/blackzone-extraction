import { describe, expect, it } from 'vitest';
import {
  createBattlefieldActionGroundPreviewGeometry,
  writeBattlefieldActionGroundPreviewGeometry,
} from '../../assets/bundles/battlefield/action-modules/geometry/battlefield-action-ground-preview-geometry';

describe('抓取世界空间地面预览几何', () => {
  it('保持固定拓扑并让锁定目标吸引楔形尖端', () => {
    const geometry = createBattlefieldActionGroundPreviewGeometry();
    writeBattlefieldActionGroundPreviewGeometry(
      geometry,
      0,
      0.08,
      0,
      0,
      1,
      2,
      2.5,
      false,
      0,
    );
    const unlocked = geometry.positions.slice();
    const vertexCount = geometry.vertexCount;
    const indexCount = geometry.indexCount;

    writeBattlefieldActionGroundPreviewGeometry(
      geometry,
      0,
      0.08,
      0,
      0,
      1,
      2,
      2.5,
      true,
      0.25,
    );

    expect(geometry.vertexCount).toBe(vertexCount);
    expect(geometry.indexCount).toBe(indexCount);
    expect(Array.from(geometry.positions).every(Number.isFinite)).toBe(true);
    expect(Array.from(geometry.colors).every(Number.isFinite)).toBe(true);
    expect(geometry.positions).not.toEqual(unlocked);
  });
});
