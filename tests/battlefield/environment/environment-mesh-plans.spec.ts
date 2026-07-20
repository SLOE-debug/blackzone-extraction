import { describe, expect, it } from 'vitest';
import {
  BATTLEFIELD_ENVIRONMENT_CATALOG,
  BattlefieldEnvironmentPrototype,
} from '../../../assets/bundles/battlefield/environment/catalog/battlefield-environment-catalog';
import { prepareBattlefieldEnvironment } from '../../../assets/bundles/battlefield/environment/compilation/battlefield-environment-preparation';

const PREPARED_ENVIRONMENT = prepareBattlefieldEnvironment();

describe('战场环境固定拓扑计划', () => {
  it('只从唯一 Catalog 派生稳定顺序、配置和编译结果', () => {
    expect(PREPARED_ENVIRONMENT.prototypes.map((prepared) => prepared.definition))
      .toEqual(BATTLEFIELD_ENVIRONMENT_CATALOG);
    expect(new Set(BATTLEFIELD_ENVIRONMENT_CATALOG.map(
      (definition) => definition.prototype,
    )).size).toBe(BATTLEFIELD_ENVIRONMENT_CATALOG.length);
    expect(Object.values(BattlefieldEnvironmentPrototype)).toEqual(
      BATTLEFIELD_ENVIRONMENT_CATALOG.map((definition) => definition.prototype),
    );
  });

  it('为全部稳定原型生成有限、非退化且属性完整的三角网格', () => {
    for (const prepared of PREPARED_ENVIRONMENT.prototypes) {
      const plan = prepared.plan;
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
