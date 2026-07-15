import { describe, expect, it } from 'vitest';
import { createEntityRange } from '../../assets/core/entities/entity-range';
import {
  createSurfaceGeometry,
  GeometryIndexFormat,
} from '../../assets/core/geometry/buffer-geometry';
import { TriangleMeshWriter } from '../../assets/core/geometry/triangle-mesh-writer';
import { directionalVertexShading } from '../../assets/core/rendering/directional-vertex-shading';
import { curveCrawlerBodyGeometry } from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-body-geometry';
import { curveCrawlerEyeGeometry } from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-eye-geometry';
import { curveCrawlerSurfaceGeometry } from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-surface-geometry';
import {
  CURVE_CRAWLER_BODY_TOPOLOGY,
  CURVE_CRAWLER_EYE_TOPOLOGY,
  CURVE_CRAWLER_SURFACE_TOPOLOGY,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-topology';
import { normalizeCurveCrawlerOptions } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-options';
import { CurveCrawlerState } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-state';
import { curveCrawlerVertexShading } from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-vertex-shading';

function createState(): CurveCrawlerState {
  return new CurveCrawlerState(normalizeCurveCrawlerOptions({
    count: 2,
    spawnArea: { width: 320, height: 180 },
    seed: 42,
  }));
}

describe('Curve Crawler 固定拓扑', () => {
  it('身体和眼睛写入精确的声明计数', () => {
    const state = createState();
    const range = createEntityRange(0, state.count, state.count);
    const body = createSurfaceGeometry(
      CURVE_CRAWLER_BODY_TOPOLOGY.verticesPerEntity * state.count,
      CURVE_CRAWLER_BODY_TOPOLOGY.indicesPerEntity * state.count,
      GeometryIndexFormat.Uint16,
    );
    const eyes = createSurfaceGeometry(
      CURVE_CRAWLER_EYE_TOPOLOGY.verticesPerEntity * state.count,
      CURVE_CRAWLER_EYE_TOPOLOGY.indicesPerEntity * state.count,
      GeometryIndexFormat.Uint16,
    );
    const bodyWriter = new TriangleMeshWriter(body);
    const eyeWriter = new TriangleMeshWriter(eyes);

    bodyWriter.reset(true);
    curveCrawlerBodyGeometry.write(bodyWriter, state, range);
    bodyWriter.commit();
    eyeWriter.reset(true);
    curveCrawlerEyeGeometry.write(eyeWriter, state, range);
    eyeWriter.commit();
    directionalVertexShading.update(body);
    directionalVertexShading.update(eyes);

    expect(body.vertexCount).toBe(506 * state.count);
    expect(body.indexCount).toBe(2256 * state.count);
    expect(eyes.vertexCount).toBe(56 * state.count);
    expect(eyes.indexCount).toBe(216 * state.count);
    expect(Array.from(body.normals).some((value) => Math.abs(value) > 0.001)).toBe(true);
    expect(Array.from(body.colors).some(
      (value, index) => index % 4 !== 3 && value > 0.32,
    )).toBe(true);
    let maximumZ = Number.NEGATIVE_INFINITY;
    for (let offset = 2; offset < body.vertexCount * 3; offset += 3) {
      maximumZ = Math.max(maximumZ, body.positions[offset] ?? 0);
    }
    expect(maximumZ).toBeGreaterThan(1);

    for (let offset = 0; offset < body.vertexCount * 3; offset += 3) {
      const normalX = body.normals[offset] ?? 0;
      const normalY = body.normals[offset + 1] ?? 0;
      const normalZ = body.normals[offset + 2] ?? 0;
      expect(Math.hypot(normalX, normalY, normalZ)).toBeCloseTo(1, 4);
    }
  });

  it('身体和双眼合并为一个带分区顶点色的 Uint32 表面', () => {
    const state = createState();
    const range = createEntityRange(0, state.count, state.count);
    const geometry = createSurfaceGeometry(
      CURVE_CRAWLER_SURFACE_TOPOLOGY.verticesPerEntity * state.count,
      CURVE_CRAWLER_SURFACE_TOPOLOGY.indicesPerEntity * state.count,
      GeometryIndexFormat.Uint32,
    );
    const writer = new TriangleMeshWriter(geometry);

    writer.reset(true);
    curveCrawlerSurfaceGeometry.write(writer, state, range);
    writer.commit();
    curveCrawlerVertexShading.update(geometry);

    expect(geometry.vertexCount).toBe(562 * state.count);
    expect(geometry.indexCount).toBe(2472 * state.count);
    expect(geometry.index).toBeInstanceOf(Uint32Array);

    const eyeColorOffset = CURVE_CRAWLER_BODY_TOPOLOGY.verticesPerEntity * state.count * 4;
    expect(geometry.colors[0] ?? 0).toBeLessThan(0.1);
    expect(geometry.colors[eyeColorOffset] ?? 0).toBeGreaterThan(0.3);
    expect(geometry.colors[eyeColorOffset + 1] ?? 1).toBeLessThan(0.1);
  });

  it('动态帧只重写位置并保持索引完全不变', () => {
    const state = createState();
    const range = createEntityRange(0, state.count, state.count);
    const geometry = createSurfaceGeometry(
      CURVE_CRAWLER_BODY_TOPOLOGY.verticesPerEntity * state.count,
      CURVE_CRAWLER_BODY_TOPOLOGY.indicesPerEntity * state.count,
      GeometryIndexFormat.Uint16,
    );
    const writer = new TriangleMeshWriter(geometry);
    writer.reset(true);
    curveCrawlerBodyGeometry.write(writer, state, range);
    writer.commit();
    const originalIndices = Array.from(geometry.index);
    const originalFirstPosition = geometry.positions[0];

    state.data.transform.x[0] = (state.data.transform.x[0] ?? 0) + 5;
    writer.reset(false);
    curveCrawlerBodyGeometry.write(writer, state, range);
    writer.assertCounts(geometry.vertexCount, geometry.indexCount);
    writer.commit();

    expect(Array.from(geometry.index)).toEqual(originalIndices);
    expect(geometry.positions[0]).not.toBe(originalFirstPosition);
  });
});
