import { describe, expect, it } from 'vitest';
import {
  createStaticSurfaceGeometry,
  GeometryIndexFormat,
} from '../../assets/core/geometry/buffer-geometry';
import { TriangleMeshWriter } from '../../assets/core/geometry/triangle-mesh-writer';
import {
  appendFlatGridPatch,
  getFlatGridPatchMetrics,
  GridPatchDiagonal,
} from '../../assets/lobby/geometry/infrastructure/flat-grid-patch';
import { GeometrySectionComposer } from '../../assets/lobby/geometry/infrastructure/geometry-section-composer';
import { defineSurfaceFrame } from '../../assets/lobby/geometry/infrastructure/surface-frame';
import { appendLobbyTriangle } from '../../assets/lobby/geometry/lobby-triangle-geometry';

enum TestSection {
  First = 'first',
  Second = 'second',
}

describe('大厅 Low Poly 初步框架', () => {
  it('按局部曲面坐标生成独立顶点和朝上的 Flat Grid', () => {
    const metrics = getFlatGridPatchMetrics(1, 1);
    const geometry = createStaticSurfaceGeometry(
      metrics.verticesPerEntity,
      metrics.indicesPerEntity,
      GeometryIndexFormat.Uint16,
    );
    const writer = new TriangleMeshWriter(geometry);
    writer.reset(true);
    appendFlatGridPatch(writer, {
      columns: 1,
      rows: 1,
      width: 2,
      height: 4,
      frame: defineSurfaceFrame({
        originX: 1, originY: 2, originZ: 3,
        ux: 1, uy: 0, uz: 0,
        vx: 0, vy: 0, vz: 1,
        nx: 0, ny: 1, nz: 0,
      }),
      sampleLocal(out): void {
        out.n = 1;
      },
      diagonal: GridPatchDiagonal.Forward,
      alternatingOffset: 0,
      flipWinding: true,
    }, Object.freeze({}));
    writer.commit();

    expect(geometry.vertexCount).toBe(6);
    expect(geometry.indexCount).toBe(6);
    expect(Array.from(geometry.getPositionView())).toEqual([
      1, 3, 3,
      3, 3, 7,
      3, 3, 3,
      1, 3, 3,
      1, 3, 7,
      3, 3, 7,
    ]);
    for (let offset = 0; offset < geometry.vertexCount * 3; offset += 3) {
      expect(geometry.normals[offset]).toBeCloseTo(0);
      expect(geometry.normals[offset + 1]).toBeCloseTo(1);
      expect(geometry.normals[offset + 2]).toBeCloseTo(0);
    }
  });

  it('记录完整的类型化顶点与索引区段并拒绝重复写入', () => {
    const geometry = createStaticSurfaceGeometry(6, 6, GeometryIndexFormat.Uint16);
    const writer = new TriangleMeshWriter(geometry);
    const sections = new GeometrySectionComposer<TestSection>(writer);
    writer.reset(true);
    sections.write(TestSection.First, () => {
      appendLobbyTriangle(
        writer,
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
      );
    });
    sections.write(TestSection.Second, () => {
      appendLobbyTriangle(
        writer,
        { x: 0, y: 0, z: 1 },
        { x: 1, y: 0, z: 1 },
        { x: 0, y: 1, z: 1 },
      );
    });
    const ranges = sections.toRecord([TestSection.First, TestSection.Second]);

    expect(ranges[TestSection.First]).toEqual({
      startVertex: 0,
      vertexCount: 3,
      startIndex: 0,
      indexCount: 3,
    });
    expect(ranges[TestSection.Second]).toEqual({
      startVertex: 3,
      vertexCount: 3,
      startIndex: 3,
      indexCount: 3,
    });
    expect(() => sections.write(TestSection.First, () => {})).toThrow(/重复写入/);
  });
});
