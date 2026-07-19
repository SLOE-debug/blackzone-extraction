import { describe, expect, it } from 'vitest';
import { createEntityRange } from '../../assets/core/entities/entity-range';
import { MeshDirty } from '../../assets/core/mesh/mesh-dirty';
import {
  curveCrawlerMeshPlan,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-mesh-compiler';
import {
  curveCrawlerMeshEvaluator,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-mesh-evaluator';
import {
  CURVE_CRAWLER_BODY_TOPOLOGY,
  CURVE_CRAWLER_EMERGENCE_MESH_TOPOLOGY,
  CURVE_CRAWLER_EYE_TOPOLOGY,
  CURVE_CRAWLER_LIQUID_TOPOLOGY,
  CURVE_CRAWLER_SURFACE_TOPOLOGY,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-topology';
import {
  createCurveCrawlerMeshTestState,
  createCurveCrawlerMeshTestStreams,
} from './mesh-test-fixture';

describe('Curve Crawler 编译式动态几何', () => {
  it('单实体计划按身体、眼睛、液体和出生几何连续布局并写出完整流', () => {
    const state = createCurveCrawlerMeshTestState(2);
    const range = createEntityRange(0, state.count, state.count);
    const streams = createCurveCrawlerMeshTestStreams(curveCrawlerMeshPlan, range.count);

    expect(curveCrawlerMeshPlan.body.vertexCount).toBe(
      CURVE_CRAWLER_BODY_TOPOLOGY.verticesPerEntity,
    );
    expect(curveCrawlerMeshPlan.eyes.vertexCount).toBe(
      CURVE_CRAWLER_EYE_TOPOLOGY.verticesPerEntity,
    );
    expect(curveCrawlerMeshPlan.liquidFan.vertexCount).toBe(
      CURVE_CRAWLER_LIQUID_TOPOLOGY.verticesPerEntity,
    );
    expect(curveCrawlerMeshPlan.emergence.vertexCount).toBe(
      CURVE_CRAWLER_EMERGENCE_MESH_TOPOLOGY.verticesPerEntity,
    );
    expect(curveCrawlerMeshPlan.vertexCount).toBe(
      CURVE_CRAWLER_SURFACE_TOPOLOGY.verticesPerEntity,
    );
    expect(curveCrawlerMeshPlan.indexCount).toBe(
      CURVE_CRAWLER_SURFACE_TOPOLOGY.indicesPerEntity,
    );

    expect(curveCrawlerMeshEvaluator.evaluate(
      state,
      curveCrawlerMeshPlan,
      streams,
      range,
      MeshDirty.All,
    )).toBe(MeshDirty.All);
    expect(streams.positions).toHaveLength(curveCrawlerMeshPlan.vertexCount * state.count * 3);
    expect(streams.normals).toHaveLength(curveCrawlerMeshPlan.vertexCount * state.count * 3);
    expect(streams.colors).toHaveLength(curveCrawlerMeshPlan.vertexCount * state.count * 4);
    expect(Array.from(streams.positions).every(Number.isFinite)).toBe(true);
    expect(Array.from(streams.normals).every(Number.isFinite)).toBe(true);

    const eyeColorOffset = curveCrawlerMeshPlan.eyes.vertexOffset * 4;
    const liquidColorOffset = curveCrawlerMeshPlan.liquid.vertexOffset * 4;
    expect(streams.colors[0]).toBeCloseTo(92 / 255, 6);
    expect(streams.colors[eyeColorOffset]).toBeCloseTo(1, 6);
    expect(streams.colors[eyeColorOffset + 1]).toBeCloseTo(168 / 255, 6);
    expect(streams.colors[liquidColorOffset]).toBeCloseTo(27 / 255, 6);
    expect(streams.colors[liquidColorOffset + 1]).toBeCloseTo(82 / 255, 6);
  });

  it('液体沿负 Y 方向收拢时保持固定局部索引并退化为零面积', () => {
    const state = createCurveCrawlerMeshTestState(1);
    const range = createEntityRange(0, 1, 1);
    const streams = createCurveCrawlerMeshTestStreams(curveCrawlerMeshPlan, range.count);
    state.data.animation.liquidSpread[0] = 1;
    state.data.animation.liquidDrain[0] = 0;
    const indices = Array.from(curveCrawlerMeshPlan.indices);

    curveCrawlerMeshEvaluator.evaluate(
      state,
      curveCrawlerMeshPlan,
      streams,
      range,
      MeshDirty.Pose,
    );
    const liquidStart = curveCrawlerMeshPlan.liquid.vertexOffset * 3;
    const expandedCenterY = streams.positions[liquidStart + 1] ?? 0;

    state.data.animation.liquidDrain[0] = 1;
    curveCrawlerMeshEvaluator.evaluate(
      state,
      curveCrawlerMeshPlan,
      streams,
      range,
      MeshDirty.Pose,
    );

    const drainedY = streams.positions[liquidStart + 1] ?? 0;
    expect(drainedY).toBeLessThan(expandedCenterY);
    for (let vertex = curveCrawlerMeshPlan.liquid.vertexOffset;
      vertex < curveCrawlerMeshPlan.liquid.vertexOffset
        + curveCrawlerMeshPlan.liquidFan.vertexCount;
      vertex++) {
      expect(streams.positions[vertex * 3 + 1]).toBeCloseTo(drainedY, 5);
    }
    expect(Array.from(curveCrawlerMeshPlan.indices)).toEqual(indices);
  });

  it('动态姿态仅上传几何语义，颜色流和固定索引不会被改写', () => {
    const state = createCurveCrawlerMeshTestState(2);
    const range = createEntityRange(0, state.count, state.count);
    const streams = createCurveCrawlerMeshTestStreams(curveCrawlerMeshPlan, range.count);
    curveCrawlerMeshEvaluator.evaluate(
      state,
      curveCrawlerMeshPlan,
      streams,
      range,
      MeshDirty.All,
    );
    const colors = streams.colors.slice();
    const positions = streams.positions.slice();
    const indices = Array.from(curveCrawlerMeshPlan.indices);
    state.data.transform.x[0] = (state.data.transform.x[0] ?? 0) + 5;

    expect(curveCrawlerMeshEvaluator.evaluate(
      state,
      curveCrawlerMeshPlan,
      streams,
      range,
      MeshDirty.Geometry,
    )).toBe(MeshDirty.Geometry);
    expect(Array.from(streams.positions)).not.toEqual(Array.from(positions));
    expect(Array.from(streams.colors)).toEqual(Array.from(colors));
    expect(Array.from(curveCrawlerMeshPlan.indices)).toEqual(indices);
  });

  it('爆裂碎块和完全坍缩始终产生有限顶点，坍缩不重写索引', () => {
    const state = createCurveCrawlerMeshTestState(1);
    const range = createEntityRange(0, 1, 1);
    const streams = createCurveCrawlerMeshTestStreams(curveCrawlerMeshPlan, range.count);
    state.data.animation.surfaceCollapse[0] = 0.74;
    state.data.animation.liquidSpread[0] = 0.9;
    for (let fragment = 0; fragment < 12; fragment++) {
      state.data.animation.fragmentOffsetX[fragment] = fragment * 0.31;
      state.data.animation.fragmentOffsetY[fragment] = -fragment * 0.17;
      state.data.animation.fragmentOffsetZ[fragment] = fragment * 0.09;
      state.data.animation.fragmentRotation[fragment] = fragment * 0.13;
    }
    const indices = Array.from(curveCrawlerMeshPlan.indices);

    curveCrawlerMeshEvaluator.evaluate(
      state,
      curveCrawlerMeshPlan,
      streams,
      range,
      MeshDirty.Geometry,
    );
    expect(Array.from(streams.positions).every(Number.isFinite)).toBe(true);
    expect(Array.from(streams.normals).every(Number.isFinite)).toBe(true);

    state.data.animation.surfaceCollapse[0] = 1;
    curveCrawlerMeshEvaluator.evaluate(
      state,
      curveCrawlerMeshPlan,
      streams,
      range,
      MeshDirty.Geometry,
    );
    expect(Array.from(streams.positions).every(Number.isFinite)).toBe(true);
    expect(Array.from(streams.normals).every(Number.isFinite)).toBe(true);
    expect(Array.from(curveCrawlerMeshPlan.indices)).toEqual(indices);
  });
});
