import { describe, expect, it } from 'vitest';
import {
  BATTLEFIELD_ENVIRONMENT_MESH_BATCH_COUNT,
} from '../../../assets/bundles/battlefield/environment/geometry/battlefield-environment-mega-mesh-layout';
import { BATTLEFIELD_ENVIRONMENT_CATALOG } from '../../../assets/bundles/battlefield/environment/catalog/battlefield-environment-catalog';
import { prepareBattlefieldEnvironment } from '../../../assets/bundles/battlefield/environment/compilation/battlefield-environment-preparation';
import { VertexSemantic } from '../../../assets/core/mesh/vertex-layout';

const PREPARED_ENVIRONMENT = prepareBattlefieldEnvironment();

describe('战场环境统一大网格布局', () => {
  it('把全部环境原型压进一个 Uint32 渲染批次', () => {
    const layout = PREPARED_ENVIRONMENT.megaMeshLayout;
    expect(BATTLEFIELD_ENVIRONMENT_MESH_BATCH_COUNT).toBe(1);
    expect(layout.sections.map((section) => section.id))
      .toEqual(BATTLEFIELD_ENVIRONMENT_CATALOG.map((definition) => definition.prototype));
    expect(layout.sections.map((section) => section.repeatCount))
      .toEqual(BATTLEFIELD_ENVIRONMENT_CATALOG.map((definition) => definition.capacity));
    expect(layout.indices).toBeInstanceOf(Uint32Array);
    expect(layout.vertexLayout.semantics).toEqual([
      VertexSemantic.Position,
      VertexSemantic.Color,
    ]);
    expect(layout.vertexCount).toBeGreaterThan(65_535);
    expect(layout.vertexCount).toBeLessThan(600_000);
    expect(layout.indexCount).toBe(layout.vertexCount);
    const removedNormalBytes = layout.vertexCount * 3 * Float32Array.BYTES_PER_ELEMENT;
    expect(removedNormalBytes).toBeGreaterThan(5 * 1024 * 1024);
  });

  it('为全部原型区段写入连续且不越界的全局索引', () => {
    const layout = PREPARED_ENVIRONMENT.megaMeshLayout;
    const indices = layout.indices;

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
