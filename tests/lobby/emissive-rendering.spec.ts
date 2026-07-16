import { describe, expect, it } from 'vitest';
import {
  createStaticSurfaceGeometry,
  GeometryIndexFormat,
} from '../../assets/core/geometry/buffer-geometry';
import { TriangleMeshWriter } from '../../assets/core/geometry/triangle-mesh-writer';
import {
  lobbyEmissiveGeometry,
  LOBBY_EMISSIVE_TOPOLOGY,
} from '../../assets/lobby/geometry/lobby-emissive-geometry';
import { lobbyEmissiveVertexShading } from '../../assets/lobby/rendering/lobby-emissive-vertex-shading';

describe('大厅发光面合批', () => {
  it('合并顶灯和仪式灯并保留两类独立颜色', () => {
    const geometry = createStaticSurfaceGeometry(
      LOBBY_EMISSIVE_TOPOLOGY.verticesPerEntity,
      LOBBY_EMISSIVE_TOPOLOGY.indicesPerEntity,
      GeometryIndexFormat.Uint16,
    );
    const writer = new TriangleMeshWriter(geometry);
    writer.reset(true);
    const ranges = lobbyEmissiveGeometry.write(writer);
    writer.commit();
    lobbyEmissiveVertexShading.update(geometry, ranges);

    expect(geometry.vertexCount).toBe(LOBBY_EMISSIVE_TOPOLOGY.verticesPerEntity);
    expect(geometry.indexCount).toBe(LOBBY_EMISSIVE_TOPOLOGY.indicesPerEntity);
    expect(ranges.ritualGlow.startVertex).toBeGreaterThan(ranges.lampGlow.startVertex);
    expectVertexColor(
      geometry.colors,
      ranges.lampGlow.startVertex,
      [1, 244 / 255, 214 / 255, 1],
    );
    expectVertexColor(
      geometry.colors,
      ranges.ritualGlow.startVertex,
      [1, 18 / 255, 42 / 255, 1],
    );
  });
});

/** 验证指定顶点的 RGBA 浮点颜色。 */
function expectVertexColor(
  colors: Float32Array,
  vertex: number,
  expected: readonly [number, number, number, number],
): void {
  const offset = vertex * 4;
  for (let channel = 0; channel < expected.length; channel++) {
    expect(colors[offset + channel]).toBeCloseTo(expected[channel] ?? 0);
  }
}
