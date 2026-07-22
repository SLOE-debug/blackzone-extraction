import { describe, expect, it } from 'vitest';
import { AKM_GEOMETRY } from '../../assets/bundles/battlefield/equipment/items/akm/akm-geometry';
import { KRISS_VECTOR_GEOMETRY } from '../../assets/bundles/battlefield/equipment/items/kriss-vector/kriss-vector-geometry';
import { M4A1_GEOMETRY } from '../../assets/bundles/battlefield/equipment/items/m4a1/m4a1-geometry';

describe('新增枪械程序化模型', () => {
  it.each([
    ['KRISS Vector', KRISS_VECTOR_GEOMETRY],
    ['M4A1', M4A1_GEOMETRY],
    ['AKM', AKM_GEOMETRY],
  ])('%s 使用适合大厅放大的完整硬分面拓扑', (_name, geometry) => {
    expect(geometry.vertexCount).toBeGreaterThan(300);
    expect(geometry.vertexCount).toBeLessThan(4000);
    expect(geometry.indexCount).toBe(geometry.vertexCount);
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let offset = 0; offset < geometry.positions.length; offset += 3) {
      minX = Math.min(minX, geometry.positions[offset] ?? 0);
      maxX = Math.max(maxX, geometry.positions[offset] ?? 0);
      minY = Math.min(minY, geometry.positions[offset + 1] ?? 0);
      maxY = Math.max(maxY, geometry.positions[offset + 1] ?? 0);
      expect(Math.hypot(
        geometry.normals[offset] ?? 0,
        geometry.normals[offset + 1] ?? 0,
        geometry.normals[offset + 2] ?? 0,
      )).toBeCloseTo(1, 5);
    }
    expect(maxX - minX).toBeGreaterThan(4);
    expect(maxY - minY).toBeGreaterThan(1.8);
  });
});
