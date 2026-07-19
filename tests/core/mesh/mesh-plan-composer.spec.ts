import { describe, expect, it } from 'vitest';
import { GeometryIndexFormat } from '../../../assets/core/geometry/buffer-geometry';
import { composeRepeatedMeshPlans } from '../../../assets/core/mesh/mesh-plan-composer';
import { type MeshPlan } from '../../../assets/core/mesh/mesh-plan';

const TRIANGLE_PLAN: MeshPlan = Object.freeze({
  vertexCount: 3,
  indexCount: 3,
  indices: new Uint16Array([0, 1, 2]),
});

const QUAD_PLAN: MeshPlan = Object.freeze({
  vertexCount: 4,
  indexCount: 6,
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
});

describe('重复网格计划组合器', () => {
  it('计算连续区段并写入实例与区段双重偏移', () => {
    const composed = composeRepeatedMeshPlans([
      { id: 'triangle', plan: TRIANGLE_PLAN, repeatCount: 2 },
      { id: 'quad', plan: QUAD_PLAN, repeatCount: 1 },
    ], GeometryIndexFormat.Uint16);

    expect(composed.vertexCount).toBe(10);
    expect(composed.indexCount).toBe(12);
    expect(Array.from(composed.indices)).toEqual([
      0, 1, 2,
      3, 4, 5,
      6, 7, 8, 6, 8, 9,
    ]);
    expect(composed.sections.map((section) => ({
      id: section.id,
      vertexOffset: section.vertexOffset,
      indexOffset: section.indexOffset,
    }))).toEqual([
      { id: 'triangle', vertexOffset: 0, indexOffset: 0 },
      { id: 'quad', vertexOffset: 6, indexOffset: 6 },
    ]);
  });

  it('拒绝超过 Uint16 索引范围的组合容量', () => {
    expect(() => composeRepeatedMeshPlans([
      { id: 'too-large', plan: QUAD_PLAN, repeatCount: 16_385 },
    ], GeometryIndexFormat.Uint16)).toThrow('索引格式');
  });
});
