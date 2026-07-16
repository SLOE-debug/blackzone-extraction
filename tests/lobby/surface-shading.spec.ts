import { describe, expect, it } from 'vitest';
import {
  createStaticSurfaceGeometry,
  GeometryIndexFormat,
} from '../../assets/core/geometry/buffer-geometry';
import { TriangleMeshWriter } from '../../assets/core/geometry/triangle-mesh-writer';
import { lobbyOpaqueGeometry } from '../../assets/lobby/geometry/lobby-opaque-geometry';
import { LobbyOpaqueSection } from '../../assets/lobby/geometry/lobby-geometry-topology';
import { lobbyVertexShading } from '../../assets/lobby/rendering/lobby-vertex-shading';

describe('大厅表面顶点参数', () => {
  it('按稳定区段写入暗红顶点色并保持完全不透明', () => {
    const geometry = createStaticSurfaceGeometry(
      lobbyOpaqueGeometry.metrics.verticesPerEntity,
      lobbyOpaqueGeometry.metrics.indicesPerEntity,
      GeometryIndexFormat.Uint16,
    );
    const writer = new TriangleMeshWriter(geometry);
    writer.reset(true);
    const ranges = lobbyOpaqueGeometry.write(writer);
    writer.commit();

    lobbyVertexShading.update(geometry, ranges);

    expectDarkRedColor(geometry.colors, ranges[LobbyOpaqueSection.Floor].startVertex);
    expectDarkRedColor(geometry.colors, ranges[LobbyOpaqueSection.CircularFrame].startVertex);
    expectDarkRedColor(geometry.colors, ranges[LobbyOpaqueSection.Character].startVertex);
  });
});

/** 验证单个顶点使用红色主导且完全不透明的颜色。 */
function expectDarkRedColor(
  colors: Float32Array,
  vertex: number,
): void {
  const colorOffset = vertex * 4;
  const red = colors[colorOffset] ?? 0;
  const green = colors[colorOffset + 1] ?? 0;
  const blue = colors[colorOffset + 2] ?? 0;
  expect(red).toBeGreaterThan(Math.max(green, blue) * 1.8);
  expect(colors[colorOffset + 3]).toBeCloseTo(1);
}
