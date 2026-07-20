import { describe, expect, it } from 'vitest';
import { DESERT_EAGLE_GEOMETRY } from '../../assets/bundles/battlefield/equipment/geometry/desert-eagle-geometry';

describe('沙漠之鹰程序化模型', () => {
  it('包含可辨识的低密度硬分面和完整顶点流', () => {
    expect(DESERT_EAGLE_GEOMETRY.vertexCount).toBeGreaterThan(100);
    expect(DESERT_EAGLE_GEOMETRY.vertexCount).toBeLessThan(1000);
    expect(DESERT_EAGLE_GEOMETRY.indexCount).toBe(DESERT_EAGLE_GEOMETRY.vertexCount);
    expect(DESERT_EAGLE_GEOMETRY.getPositionView()).toHaveLength(
      DESERT_EAGLE_GEOMETRY.vertexCount * 3,
    );
    for (let offset = 0; offset < DESERT_EAGLE_GEOMETRY.normals.length; offset += 3) {
      expect(Math.hypot(
        DESERT_EAGLE_GEOMETRY.normals[offset] ?? 0,
        DESERT_EAGLE_GEOMETRY.normals[offset + 1] ?? 0,
        DESERT_EAGLE_GEOMETRY.normals[offset + 2] ?? 0,
      )).toBeCloseTo(1, 5);
    }
  });
});
