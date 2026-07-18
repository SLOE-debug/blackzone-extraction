import { describe, expect, it } from 'vitest';
import {
  BATTLEFIELD_ENVIRONMENT_MEGA_MESH_LAYOUT,
  BATTLEFIELD_ENVIRONMENT_MESH_BATCH_COUNT,
  writeBattlefieldEnvironmentMegaMeshIndices,
} from '../../../assets/bundles/battlefield/environment/geometry/battlefield-environment-mega-mesh-layout';
import { BATTLEFIELD_ENVIRONMENT_PROTOTYPES } from '../../../assets/bundles/battlefield/environment/model/battlefield-environment-prototype';

describe('战场环境统一大网格布局', () => {
  it('把全部环境原型压进一个 Uint32 渲染批次', () => {
    const layout = BATTLEFIELD_ENVIRONMENT_MEGA_MESH_LAYOUT;
    expect(BATTLEFIELD_ENVIRONMENT_MESH_BATCH_COUNT).toBe(1);
    expect(layout.sections.map((section) => section.prototype))
      .toEqual(BATTLEFIELD_ENVIRONMENT_PROTOTYPES);
    expect(layout.vertexCount).toBeGreaterThan(65_535);
    expect(layout.vertexCount).toBeLessThan(600_000);
    expect(layout.indexCount).toBe(layout.vertexCount);
  });

  it('为全部原型区段写入连续且不越界的全局索引', () => {
    const layout = BATTLEFIELD_ENVIRONMENT_MEGA_MESH_LAYOUT;
    const indices = new Uint32Array(layout.indexCount);
    writeBattlefieldEnvironmentMegaMeshIndices(indices, layout);

    let previousVertexEnd = 0;
    let previousIndexEnd = 0;
    for (const section of layout.sections) {
      expect(section.vertexOffset).toBe(previousVertexEnd);
      expect(section.indexOffset).toBe(previousIndexEnd);
      previousVertexEnd += section.vertexCount;
      previousIndexEnd += section.indexCount;
    }
    expect(previousVertexEnd).toBe(layout.vertexCount);
    expect(previousIndexEnd).toBe(layout.indexCount);
    expect(Math.max(...indices.subarray(0, 10_000))).toBeLessThan(layout.vertexCount);
    expect(indices[indices.length - 1]).toBeLessThan(layout.vertexCount);
  });
});
