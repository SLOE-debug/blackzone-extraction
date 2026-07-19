import { describe, expect, it } from 'vitest';
import {
  createStaticSurfaceGeometry,
  GeometryIndexFormat,
} from '../../assets/core/geometry/buffer-geometry';
import { TriangleMeshWriter } from '../../assets/core/geometry/triangle-mesh-writer';
import { GeometrySectionComposer } from '../../assets/core/geometry/sections/geometry-section-composer';
import { appendLobbyTriangle } from '../../assets/lobby/geometry/lobby-triangle-geometry';

enum TestSection {
  First = 'first',
  Second = 'second',
}

describe('大厅 Low Poly 初步框架', () => {
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
