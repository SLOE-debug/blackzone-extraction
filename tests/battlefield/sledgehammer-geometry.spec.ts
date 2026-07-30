import { describe, expect, it } from 'vitest';
import { SLEDGEHAMMER_GEOMETRY } from '../../assets/bundles/battlefield/equipment/items/sledgehammer/sledgehammer-geometry';
import { SLEDGEHAMMER_PROTOTYPE } from '../../assets/bundles/battlefield/equipment/items/sledgehammer/sledgehammer-prototype';

describe('裂岩大锤程序化造型', () => {
  it('在单一固定拓扑中保留分层锤柄与锤头预算', () => {
    const triangleCount = SLEDGEHAMMER_GEOMETRY.indexCount / 3;
    expect(triangleCount).toBeGreaterThan(220);
    expect(triangleCount).toBeLessThanOrEqual(280);
    expect(SLEDGEHAMMER_GEOMETRY.vertexCount).toBe(
      SLEDGEHAMMER_GEOMETRY.indexCount,
    );
  });

  it('全部三角形拥有有限单位法线和明显预烘色阶', () => {
    const normals = SLEDGEHAMMER_GEOMETRY.getNormalView();
    for (let offset = 0; offset < normals.length; offset += 3) {
      const length = Math.hypot(
        normals[offset] ?? 0,
        normals[offset + 1] ?? 0,
        normals[offset + 2] ?? 0,
      );
      expect(length).toBeCloseTo(1, 5);
    }
    const colors = SLEDGEHAMMER_GEOMETRY.getColorView();
    let minimum = Number.POSITIVE_INFINITY;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = 0; offset < colors.length; offset += 4) {
      const brightness = (colors[offset] ?? 0)
        + (colors[offset + 1] ?? 0)
        + (colors[offset + 2] ?? 0);
      minimum = Math.min(minimum, brightness);
      maximum = Math.max(maximum, brightness);
    }
    expect(maximum - minimum).toBeGreaterThan(0.8);
  });

  it('重做造型不改变双握点和锤头玩法坐标', () => {
    const points = SLEDGEHAMMER_PROTOTYPE.held.attachmentPoints;
    expect(points.mainGrip).toEqual({ x: 0, y: 0, z: 0 });
    expect(points.supportGrip).toEqual({ x: 0, y: -0.75, z: 0 });
    expect(points.impactHead).toEqual({ x: 0, y: -3.08, z: 0, radius: 0.82 });
  });
});
