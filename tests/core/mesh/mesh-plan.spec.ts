import { describe, expect, it } from 'vitest';
import {
  assertMeshPlan,
  type MeshPlan,
} from '../../../assets/core/mesh/mesh-plan';
import { MeshDirty } from '../../../assets/core/mesh/mesh-dirty';
import { copyMeshPlanIndices } from '../../../assets/core/mesh/mesh-plan-indices';
import { createSurfaceGeometry, GeometryIndexFormat } from '../../../assets/core/geometry/buffer-geometry';
import { createVertexStreams } from '../../../assets/core/mesh/vertex-streams';

const QUAD_PLAN: MeshPlan = Object.freeze({
  vertexCount: 4,
  indexCount: 6,
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
});

describe('编译式网格计划', () => {
  it('将位置与法线定义为不可拆分的 Pose 更新单元', () => {
    expect(MeshDirty.Pose).toBe(MeshDirty.Position | MeshDirty.Normal);
    expect(MeshDirty.Geometry).toBe(MeshDirty.Pose | MeshDirty.Bounds);
    expect(MeshDirty.All).toBe(MeshDirty.Geometry | MeshDirty.Color);
  });

  it('验证局部索引，并为连续实体批次复制正确偏移', () => {
    const indices = new Uint16Array(QUAD_PLAN.indexCount * 2);

    assertMeshPlan(QUAD_PLAN);
    copyMeshPlanIndices(QUAD_PLAN, 2, indices);

    expect(Array.from(indices)).toEqual([
      0, 1, 2, 0, 2, 3,
      4, 5, 6, 4, 6, 7,
    ]);
  });

  it('拒绝越过单实体顶点范围的局部索引', () => {
    const invalidPlan: MeshPlan = Object.freeze({
      vertexCount: 3,
      indexCount: 3,
      indices: new Uint16Array([0, 1, 3]),
    });

    expect(() => assertMeshPlan(invalidPlan)).toThrow('越界');
  });

  it('运行时流只创建现有 SurfaceBufferGeometry 的零拷贝有效视图', () => {
    const geometry = createSurfaceGeometry(4, 6, GeometryIndexFormat.Uint16);
    geometry.commitCounts(4, 6);

    const streams = createVertexStreams(geometry);
    streams.positions[0] = 12;
    streams.normals[1] = -3;
    streams.colors[2] = 0.75;

    expect(geometry.positions[0]).toBe(12);
    expect(geometry.normals[1]).toBe(-3);
    expect(geometry.colors[2]).toBe(0.75);
    expect(streams.positions.buffer).toBe(geometry.positions.buffer);
    expect(streams.normals.buffer).toBe(geometry.normals.buffer);
    expect(streams.colors.buffer).toBe(geometry.colors.buffer);
  });
});
