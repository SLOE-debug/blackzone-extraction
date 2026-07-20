import { describe, expect, it } from 'vitest';
import {
  createSurfaceGeometry,
  GeometryIndexFormat,
  type SurfaceBufferGeometry,
} from '../../assets/core/geometry/buffer-geometry';
import { TriangleMeshWriter } from '../../assets/core/geometry/triangle-mesh-writer';
import { VertexSemantic } from '../../assets/core/mesh/vertex-layout';
import {
  battlefieldGroundGeometry,
  BATTLEFIELD_GROUND_TOPOLOGY,
  type MutableBattlefieldGroundWriteRange,
} from '../../assets/bundles/battlefield/geometry/battlefield-ground-geometry';
import {
  createBattlefieldGroundPatchFrame,
  sampleBattlefieldGroundPoint,
  type BattlefieldGroundPoint,
} from '../../assets/bundles/battlefield/geometry/battlefield-ground-sampling';
import { BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG } from '../../assets/bundles/battlefield/environment/model/battlefield-environment-config';
import {
  shadeBattlefieldGround,
  shadeBattlefieldGroundRange,
} from '../../assets/bundles/battlefield/rendering/battlefield-vertex-shading';
import { BattlefieldGroundRenderGeometry } from '../../assets/bundles/battlefield/rendering/battlefield-ground-render-geometry';

describe('battlefield ground geometry', () => {
  it('writes the declared fixed topology with upward faceted normals', () => {
    const geometry = createGroundGeometry(0, 0);

    expect(geometry.vertexCount).toBe(BATTLEFIELD_GROUND_TOPOLOGY.verticesPerEntity);
    expect(geometry.indexCount).toBe(BATTLEFIELD_GROUND_TOPOLOGY.indicesPerEntity);
    for (let offset = 0; offset < geometry.normals.length; offset += 3) {
      expect(geometry.normals[offset + 1]).toBeGreaterThan(0.7);
    }
  });

  it('GPU 地面布局只上传位置和颜色，法线仅保留给 CPU 分面着色', () => {
    const metrics = battlefieldGroundGeometry.metrics;
    const geometry = new BattlefieldGroundRenderGeometry(
      metrics.verticesPerEntity,
      metrics.indicesPerEntity,
    );
    battlefieldGroundGeometry.write(new TriangleMeshWriter(geometry), 0, 0);
    shadeBattlefieldGround(geometry, 0, 0);

    expect(geometry.renderGeometry.layout.semantics).toEqual([
      VertexSemantic.Position,
      VertexSemantic.Color,
    ]);
    expect(geometry.normals).toHaveLength(metrics.verticesPerEntity * 3);
    expect(geometry.renderGeometry.vertexCount).toBe(metrics.verticesPerEntity);
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

  it('keeps overlapping world vertices continuous when the visible patch moves by one chunk', () => {
    const first = createGroundGeometry(0, 0);
    const second = createGroundGeometry(1, 0);
    const firstWorldPoints = collectWorldPointHeights(first, 0, 0);
    const secondWorldPoints = collectWorldPointHeights(second, 1, 0);
    let compared = 0;

    for (const [key, height] of firstWorldPoints) {
      const shiftedHeight = secondWorldPoints.get(key);
      if (shiftedHeight !== undefined) {
        expect(shiftedHeight).toBeCloseTo(height, 5);
        compared += 1;
      }
    }

    expect(compared).toBeGreaterThan(9_000);
  });

  it('keeps the initialized index stream unchanged when a later chunk only rewrites vertex data', () => {
    const geometry = createSurfaceGeometry(
      BATTLEFIELD_GROUND_TOPOLOGY.verticesPerEntity,
      BATTLEFIELD_GROUND_TOPOLOGY.indicesPerEntity,
      GeometryIndexFormat.Uint16,
    );
    const writer = new TriangleMeshWriter(geometry);
    writer.reset(true);
    battlefieldGroundGeometry.write(writer, 0, 0);
    writer.commit();
    const initializedIndices = geometry.getIndexView().slice();

    const range: MutableBattlefieldGroundWriteRange = {
      firstVertex: 0,
      vertexCount: 0,
      centerWorldX: 0,
      centerWorldZ: 0,
    };
    battlefieldGroundGeometry.beginWrite(writer, 1, -1, false);
    while (!battlefieldGroundGeometry.writeNextRows(writer, 11, range)) {
      // 分帧接口在完成前保持同一个 Writer 游标。
    }

    expect(geometry.getIndexView()).toEqual(initializedIndices);
  });

  it('分帧写入与一次性写入产生完全相同的地面顶点流', () => {
    const centerChunkX = 2;
    const centerChunkZ = -1;
    const expected = createGroundGeometry(centerChunkX, centerChunkZ);
    const chunkSize = BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.chunkSize;
    shadeBattlefieldGround(
      expected,
      centerChunkX * chunkSize,
      centerChunkZ * chunkSize,
    );

    const actual = createGroundGeometry(0, 0);
    const writer = new TriangleMeshWriter(actual);
    const range: MutableBattlefieldGroundWriteRange = {
      firstVertex: 0,
      vertexCount: 0,
      centerWorldX: 0,
      centerWorldZ: 0,
    };
    battlefieldGroundGeometry.beginWrite(
      writer,
      centerChunkX,
      centerChunkZ,
      false,
    );
    let complete = false;
    while (!complete) {
      complete = battlefieldGroundGeometry.writeNextRows(writer, 7, range);
      shadeBattlefieldGroundRange(
        actual,
        range.firstVertex,
        range.vertexCount,
        range.centerWorldX,
        range.centerWorldZ,
      );
    }

    expect(actual.getPositionView()).toEqual(expected.getPositionView());
    expect(actual.getNormalView()).toEqual(expected.getNormalView());
    expect(actual.getColorView()).toEqual(expected.getColorView());
    expect(actual.getIndexView()).toEqual(expected.getIndexView());
  });

  it('does not repeat the old ten-cell height pattern', () => {
    const frame = createBattlefieldGroundPatchFrame(0, 0);
    const first: BattlefieldGroundPoint = { x: 0, y: 0, z: 0 };
    const shifted: BattlefieldGroundPoint = { x: 0, y: 0, z: 0 };
    let differentSamples = 0;

    for (let row = -24; row <= 24; row++) {
      for (let column = -24; column <= 14; column++) {
        sampleBattlefieldGroundPoint(column, row, frame, first);
        sampleBattlefieldGroundPoint(column + 10, row, frame, shifted);
        if (Math.abs(first.y - shifted.y) > 0.00001) {
          differentSamples += 1;
        }
      }
    }

    expect(differentSamples).toBeGreaterThan(1_800);
  });

  it('reproduces world-space ground colors across patch changes without four-face bands', () => {
    const first = createGroundGeometry(0, 0);
    const second = createGroundGeometry(1, 0);
    const chunkSize = BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.chunkSize;
    shadeBattlefieldGround(first, 0, 0);
    shadeBattlefieldGround(second, chunkSize, 0);
    let changedLocalFaces = 0;
    for (let vertex = 0; vertex < first.vertexCount; vertex += 3) {
      const colorOffset = vertex * 4;
      const difference = Math.abs(
        (first.colors[colorOffset] ?? 0) - (second.colors[colorOffset] ?? 0),
      ) + Math.abs(
        (first.colors[colorOffset + 1] ?? 0) - (second.colors[colorOffset + 1] ?? 0),
      ) + Math.abs(
        (first.colors[colorOffset + 2] ?? 0) - (second.colors[colorOffset + 2] ?? 0),
      );
      if (difference > 0.00001) {
        changedLocalFaces += 1;
      }
    }
    expect(changedLocalFaces).toBeGreaterThan(18_000);

    const firstColors = collectWorldTriangleColors(first, 0, 0);
    const secondColors = collectWorldTriangleColors(second, 1, 0);
    let compared = 0;

    for (const [key, color] of firstColors) {
      const shiftedColor = secondColors.get(key);
      if (shiftedColor === undefined) {
        continue;
      }
      expect(shiftedColor[0]).toBeCloseTo(color[0], 5);
      expect(shiftedColor[1]).toBeCloseTo(color[1], 5);
      expect(shiftedColor[2]).toBeCloseTo(color[2], 5);
      compared += 1;
    }

    expect(compared).toBeGreaterThan(14_000);
  });
});

function createGroundPositions(): Float32Array {
  return createGroundGeometry(0, 0).getPositionView();
}

function createGroundGeometry(centerChunkX: number, centerChunkZ: number): SurfaceBufferGeometry {
  const geometry = createSurfaceGeometry(
    BATTLEFIELD_GROUND_TOPOLOGY.verticesPerEntity,
    BATTLEFIELD_GROUND_TOPOLOGY.indicesPerEntity,
    GeometryIndexFormat.Uint16,
  );
  const writer = new TriangleMeshWriter(geometry);
  writer.reset(true);
  battlefieldGroundGeometry.write(writer, centerChunkX, centerChunkZ);
  writer.commit();
  return geometry;
}

function collectWorldPointHeights(
  geometry: SurfaceBufferGeometry,
  centerChunkX: number,
  centerChunkZ: number,
): ReadonlyMap<string, number> {
  const chunkSize = BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.chunkSize;
  const centerWorldX = centerChunkX * chunkSize;
  const centerWorldZ = centerChunkZ * chunkSize;
  const points = new Map<string, number>();
  for (let offset = 0; offset < geometry.vertexCount * 3; offset += 3) {
    const worldX = centerWorldX + (geometry.positions[offset] ?? 0);
    const worldZ = centerWorldZ + (geometry.positions[offset + 2] ?? 0);
    points.set(createWorldKey(worldX, worldZ), geometry.positions[offset + 1] ?? 0);
  }
  return points;
}

function collectWorldTriangleColors(
  geometry: SurfaceBufferGeometry,
  centerChunkX: number,
  centerChunkZ: number,
): ReadonlyMap<string, readonly [number, number, number]> {
  const chunkSize = BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.chunkSize;
  const centerWorldX = centerChunkX * chunkSize;
  const centerWorldZ = centerChunkZ * chunkSize;
  const colors = new Map<string, readonly [number, number, number]>();
  for (let vertex = 0; vertex < geometry.vertexCount; vertex += 3) {
    const positionOffset = vertex * 3;
    const worldX = centerWorldX + (
      (geometry.positions[positionOffset] ?? 0)
      + (geometry.positions[positionOffset + 3] ?? 0)
      + (geometry.positions[positionOffset + 6] ?? 0)
    ) / 3;
    const worldZ = centerWorldZ + (
      (geometry.positions[positionOffset + 2] ?? 0)
      + (geometry.positions[positionOffset + 5] ?? 0)
      + (geometry.positions[positionOffset + 8] ?? 0)
    ) / 3;
    const colorOffset = vertex * 4;
    colors.set(createWorldKey(worldX, worldZ), [
      geometry.colors[colorOffset] ?? 0,
      geometry.colors[colorOffset + 1] ?? 0,
      geometry.colors[colorOffset + 2] ?? 0,
    ]);
  }
  return colors;
}

function createWorldKey(worldX: number, worldZ: number): string {
  return `${worldX.toFixed(3)},${worldZ.toFixed(3)}`;
}
