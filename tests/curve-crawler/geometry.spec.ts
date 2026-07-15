import { describe, expect, it } from 'vitest';
import { createEntityRange } from '../../assets/core/entities/entity-range';
import {
  createPositionGeometry,
  GeometryIndexFormat,
} from '../../assets/core/geometry/buffer-geometry';
import { TriangleMeshWriter } from '../../assets/core/geometry/triangle-mesh-writer';
import { curveCrawlerBodyGeometry } from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-body-geometry';
import { curveCrawlerEyeGeometry } from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-eye-geometry';
import {
  CURVE_CRAWLER_BODY_TOPOLOGY,
  CURVE_CRAWLER_EYE_TOPOLOGY,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-topology';
import { normalizeCurveCrawlerOptions } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-options';
import { CurveCrawlerState } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-state';

function createState(): CurveCrawlerState {
  return new CurveCrawlerState(normalizeCurveCrawlerOptions({
    count: 2,
    batchSize: 2,
    arena: { width: 320, height: 180 },
    seed: 42,
  }));
}

describe('Curve Crawler 固定拓扑', () => {
  it('身体和眼睛写入精确的声明计数', () => {
    const state = createState();
    const range = createEntityRange(0, state.count, state.count);
    const body = createPositionGeometry(
      CURVE_CRAWLER_BODY_TOPOLOGY.verticesPerEntity * state.count,
      CURVE_CRAWLER_BODY_TOPOLOGY.indicesPerEntity * state.count,
      GeometryIndexFormat.Uint16,
    );
    const eyes = createPositionGeometry(
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

    expect(body.vertexCount).toBe(386 * state.count);
    expect(body.indexCount).toBe(1080 * state.count);
    expect(eyes.vertexCount).toBe(30 * state.count);
    expect(eyes.indexCount).toBe(84 * state.count);
  });

  it('动态帧只重写位置并保持索引完全不变', () => {
    const state = createState();
    const range = createEntityRange(0, state.count, state.count);
    const geometry = createPositionGeometry(
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
