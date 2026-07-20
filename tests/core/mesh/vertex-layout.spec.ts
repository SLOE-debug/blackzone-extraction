import { describe, expect, it } from 'vitest';
import {
  createSurfaceGeometry,
  createVertexLayoutGeometry,
  GeometryIndexFormat,
} from '../../../assets/core/geometry/buffer-geometry';
import { createVertexStreams } from '../../../assets/core/mesh/vertex-streams';
import {
  LIT_COLOR_LAYOUT,
  UNLIT_COLOR_LAYOUT,
  VertexSemantic,
} from '../../../assets/core/mesh/vertex-layout';

describe('强类型 SoA 顶点布局', () => {
  it('由布局唯一决定流集合和顺序', () => {
    expect(LIT_COLOR_LAYOUT.semantics).toEqual([
      VertexSemantic.Position,
      VertexSemantic.Normal,
      VertexSemantic.Color,
    ]);
    expect(UNLIT_COLOR_LAYOUT.semantics).toEqual([
      VertexSemantic.Position,
      VertexSemantic.Color,
    ]);
  });

  it('无光颜色几何不会分配法线流或法线属性', () => {
    const vertexCount = 12;
    const lit = createSurfaceGeometry(vertexCount, 18, GeometryIndexFormat.Uint16);
    const unlit = createVertexLayoutGeometry(
      UNLIT_COLOR_LAYOUT,
      vertexCount,
      18,
      GeometryIndexFormat.Uint16,
    );
    lit.commitCounts(vertexCount, 18);
    unlit.commitCounts(vertexCount, 18);

    const streams = createVertexStreams(unlit);
    streams.positions[0] = 7;
    streams.colors[0] = 0.5;

    expect('normals' in streams).toBe(false);
    expect('normal' in unlit.attributes).toBe(false);
    expect(unlit.positions[0]).toBe(7);
    expect(unlit.colors[0]).toBe(0.5);
    expect(lit.normals.byteLength).toBe(vertexCount * 3 * Float32Array.BYTES_PER_ELEMENT);
  });
});
