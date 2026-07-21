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

  it('主体顶点色以蓝色通道为主，不再使用灰紫色史诗外观', () => {
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let offset = 0; offset < DESERT_EAGLE_GEOMETRY.colors.length; offset += 4) {
      red += DESERT_EAGLE_GEOMETRY.colors[offset] ?? 0;
      green += DESERT_EAGLE_GEOMETRY.colors[offset + 1] ?? 0;
      blue += DESERT_EAGLE_GEOMETRY.colors[offset + 2] ?? 0;
    }
    expect(blue).toBeGreaterThan(green * 1.5);
    expect(blue).toBeGreaterThan(red * 2.5);
  });
});
