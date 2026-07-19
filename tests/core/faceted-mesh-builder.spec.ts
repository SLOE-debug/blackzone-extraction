import { describe, expect, it } from 'vitest';
import { FacetedMeshBuilder } from '../../assets/core/geometry/faceted-mesh-builder';

const COLOR = Object.freeze({ red: 1, green: 0.5, blue: 0.2, alpha: 1 });

describe('程序化分面网格构建器', () => {
  it('为每个硬分面写入单位法线、颜色和顺序索引', () => {
    const builder = new FacetedMeshBuilder();
    builder.quad(
      COLOR,
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0.1 },
      { x: 0, y: 1, z: -0.1 },
    );
    const geometry = builder.build();
    expect(geometry.vertexCount).toBe(6);
    expect(Array.from(geometry.getIndexView())).toEqual([0, 1, 2, 3, 4, 5]);
    expect(geometry.getColorView()).toHaveLength(24);
    for (let offset = 0; offset < geometry.normals.length; offset += 3) {
      expect(Math.hypot(
        geometry.normals[offset] ?? 0,
        geometry.normals[offset + 1] ?? 0,
        geometry.normals[offset + 2] ?? 0,
      )).toBeCloseTo(1, 6);
    }
  });

  it('拒绝共线三角形', () => {
    const builder = new FacetedMeshBuilder();
    expect(() => builder.triangle(
      COLOR,
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    )).toThrow(/退化/);
  });
});
