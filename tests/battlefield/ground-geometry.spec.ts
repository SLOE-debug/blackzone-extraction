import { describe, expect, it } from 'vitest';
import {
  createStaticSurfaceGeometry,
  GeometryIndexFormat,
} from '../../assets/core/geometry/buffer-geometry';
import { TriangleMeshWriter } from '../../assets/core/geometry/triangle-mesh-writer';
import {
  battlefieldGroundGeometry,
  BATTLEFIELD_GROUND_TOPOLOGY,
} from '../../assets/bundles/battlefield/geometry/battlefield-ground-geometry';

describe('battlefield ground geometry', () => {
  it('writes the declared fixed topology with upward faceted normals', () => {
    const geometry = createStaticSurfaceGeometry(
      BATTLEFIELD_GROUND_TOPOLOGY.verticesPerEntity,
      BATTLEFIELD_GROUND_TOPOLOGY.indicesPerEntity,
      GeometryIndexFormat.Uint16,
    );
    const writer = new TriangleMeshWriter(geometry);
    writer.reset(true);
    battlefieldGroundGeometry.write(writer);
    writer.commit();

    expect(geometry.vertexCount).toBe(BATTLEFIELD_GROUND_TOPOLOGY.verticesPerEntity);
    expect(geometry.indexCount).toBe(BATTLEFIELD_GROUND_TOPOLOGY.indicesPerEntity);
    for (let offset = 0; offset < geometry.normals.length; offset += 3) {
      expect(geometry.normals[offset + 1]).toBeGreaterThan(0.7);
    }
  });

  it('keeps the player origin level while preserving deterministic terrain', () => {
    const first = createGroundPositions();
    const second = createGroundPositions();
    expect(Array.from(first)).toEqual(Array.from(second));

    let nearestDistance = Number.POSITIVE_INFINITY;
    let nearestHeight = Number.POSITIVE_INFINITY;
    for (let offset = 0; offset < first.length; offset += 3) {
      const x = first[offset] ?? 0;
      const y = first[offset + 1] ?? 0;
      const z = first[offset + 2] ?? 0;
      const distance = Math.hypot(x, z);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestHeight = y;
      }
    }
    expect(nearestDistance).toBe(0);
    expect(nearestHeight).toBe(0);
  });
});

function createGroundPositions(): Float32Array {
  const geometry = createStaticSurfaceGeometry(
    BATTLEFIELD_GROUND_TOPOLOGY.verticesPerEntity,
    BATTLEFIELD_GROUND_TOPOLOGY.indicesPerEntity,
    GeometryIndexFormat.Uint16,
  );
  const writer = new TriangleMeshWriter(geometry);
  writer.reset(true);
  battlefieldGroundGeometry.write(writer);
  writer.commit();
  return geometry.getPositionView();
}
