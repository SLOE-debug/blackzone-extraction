import { describe, expect, it } from 'vitest';
import {
  emitFixedTopologyFlatTriangle,
  emitFlatQuad,
  emitFlatTriangle,
  emitOrientedFlatTriangle,
} from '../../assets/core/geometry/faceted/faceted-emitter';
import { writeSequentialFlatNormals } from '../../assets/core/geometry/faceted/sequential-flat-normal';
import { StaticFacetedMeshSink } from '../../assets/core/geometry/faceted/static-faceted-mesh-sink';

const COLOR = Object.freeze({ red: 1, green: 0.5, blue: 0.2, alpha: 1 });

describe('程序化分面发射器', () => {
  it('为每个硬分面写入单位法线、颜色和顺序索引', () => {
    const sink = new StaticFacetedMeshSink();
    emitFlatQuad(
      sink,
      COLOR,
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0.1 },
      { x: 0, y: 1, z: -0.1 },
    );
    const geometry = sink.build();
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

  it('按期望朝外方向纠正三角形绕序', () => {
    const sink = new StaticFacetedMeshSink();
    emitOrientedFlatTriangle(
      sink,
      COLOR,
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 0, z: 0 },
      0,
      0,
      1,
    );

    const geometry = sink.build();
    expect(Array.from(geometry.getPositionView())).toEqual([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ]);
    expect(Array.from(geometry.getNormalView())).toEqual([
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ]);
  });

  it('区分普通退化检查与固定拓扑保留策略', () => {
    const points = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ] as const;
    const rejectedSink = new StaticFacetedMeshSink();
    expect(() => emitFlatTriangle(
      rejectedSink,
      COLOR,
      points[0],
      points[1],
      points[2],
    )).toThrow(/退化/);

    const preservedSink = new StaticFacetedMeshSink();
    emitFixedTopologyFlatTriangle(
      preservedSink,
      COLOR,
      points[0],
      points[1],
      points[2],
    );
    expect(Array.from(preservedSink.build().getNormalView())).toEqual([
      0, 0, 0,
      0, 0, 0,
      0, 0, 0,
    ]);
  });

  it('把双精度顺序三角形的位置写为指定偏移处的硬分面法线', () => {
    const normals = new Float32Array(12);
    writeSequentialFlatNormals(
      new Float64Array([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0,
      ]),
      normals,
      1,
    );

    expect(Array.from(normals)).toEqual([
      0, 0, 0,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ]);
  });
});
