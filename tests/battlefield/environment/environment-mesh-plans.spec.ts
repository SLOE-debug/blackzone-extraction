import { describe, expect, it } from 'vitest';
import { BATTLEFIELD_ENVIRONMENT_MESH_PLANS } from '../../../assets/bundles/battlefield/environment/geometry/battlefield-environment-mesh-plans';
import { BATTLEFIELD_ENVIRONMENT_PROTOTYPES } from '../../../assets/bundles/battlefield/environment/model/battlefield-environment-prototype';

describe('战场环境固定拓扑计划', () => {
  it('为全部稳定原型生成有限、非退化且属性完整的三角网格', () => {
    for (const prototype of BATTLEFIELD_ENVIRONMENT_PROTOTYPES) {
      const plan = BATTLEFIELD_ENVIRONMENT_MESH_PLANS[prototype];
      expect(plan.vertexCount).toBeGreaterThan(0);
      expect(plan.vertexCount % 3).toBe(0);
      expect(plan.indexCount).toBe(plan.vertexCount);
      expect(plan.localPositions.length).toBe(plan.vertexCount * 3);
      expect(plan.localNormals.length).toBe(plan.vertexCount * 3);
      expect(plan.localColors.length).toBe(plan.vertexCount * 4);
      expect(plan.facetVariants.length).toBe(plan.vertexCount);
      for (let offset = 0; offset < plan.localNormals.length; offset += 3) {
        const length = Math.hypot(
          plan.localNormals[offset] ?? 0,
          plan.localNormals[offset + 1] ?? 0,
          plan.localNormals[offset + 2] ?? 0,
        );
        expect(length).toBeCloseTo(1, 5);
      }
    }
  });
});
