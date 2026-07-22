import { describe, expect, it } from 'vitest';
import { createEntityRange } from '../../assets/core/entities/entity-range';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { MeshDirty } from '../../assets/core/mesh/mesh-dirty';
import {
  compileCurveCrawlerMeshPlan,
  curveCrawlerMeshPlan,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-mesh-compiler';
import {
  curveCrawlerMeshEvaluator,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-mesh-evaluator';
import {
  CurveCrawlerMeshSemantic,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-mesh-plan';
import {
  CURVE_CRAWLER_SURFACE_TOPOLOGY,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-topology';
import {
  createCurveCrawlerMeshTestState,
  createCurveCrawlerMeshTestStreams,
} from './mesh-test-fixture';

describe('Curve Crawler 编译式网格计划', () => {
  it('一次性编译全部体元拓扑、采样系数与顶点语义', () => {
    const freshPlan = compileCurveCrawlerMeshPlan();

    expect(freshPlan.vertexCount).toBe(CURVE_CRAWLER_SURFACE_TOPOLOGY.verticesPerEntity);
    expect(freshPlan.indexCount).toBe(CURVE_CRAWLER_SURFACE_TOPOLOGY.indicesPerEntity);
    expect(freshPlan.indices).toBeInstanceOf(Uint16Array);
    expect(freshPlan.legTube.positionCoefficients).toHaveLength(
      (freshPlan.legTube.segmentCount + 1) * 4,
    );
    expect(freshPlan.legTube.tangentCoefficients).toHaveLength(
      (freshPlan.legTube.segmentCount + 1) * 4,
    );
    expect(freshPlan.legTube.radialCosines).toHaveLength(
      freshPlan.legTube.logicalVertexCount,
    );
    expect(freshPlan.bodyEllipsoid.unitDirections).toHaveLength(
      freshPlan.bodyEllipsoid.vertexCount * 3,
    );
    expect(freshPlan.liquidFan.rayVertexOffsets).toHaveLength(freshPlan.liquidFan.rayCount);
    expect(Array.from(freshPlan.indices).every((index) => index < freshPlan.vertexCount)).toBe(true);
    expect(Array.from(freshPlan.semanticIds).filter(
      (semantic) => semantic === CurveCrawlerMeshSemantic.Leg,
    )).toHaveLength(freshPlan.legTube.vertexCount * freshPlan.body.legVertexOffsets.length);
    expect(Array.from(freshPlan.semanticIds).filter(
      (semantic) => semantic === CurveCrawlerMeshSemantic.Foot,
    )).toHaveLength(
      freshPlan.footEllipsoid.vertexCount * freshPlan.body.footVertexOffsets.length,
    );
    expect(Array.from(freshPlan.semanticIds).filter(
      (semantic) => semantic === CurveCrawlerMeshSemantic.Abdomen,
    )).toHaveLength(freshPlan.bodyEllipsoid.vertexCount);
    expect(Array.from(freshPlan.semanticIds).filter(
      (semantic) => semantic === CurveCrawlerMeshSemantic.Thorax,
    )).toHaveLength(freshPlan.bodyEllipsoid.vertexCount);
    expect(Array.from(freshPlan.semanticIds).filter(
      (semantic) => semantic === CurveCrawlerMeshSemantic.Eye,
    )).toHaveLength(freshPlan.eyes.vertexCount);
    expect(Array.from(freshPlan.semanticIds).filter(
      (semantic) => semantic === CurveCrawlerMeshSemantic.Liquid,
    )).toHaveLength(freshPlan.liquidFan.vertexCount);
    expect(Array.from(freshPlan.semanticIds).filter(
      (semantic) => semantic === CurveCrawlerMeshSemantic.EmergenceCrack,
    ).length).toBeGreaterThan(0);
    expect(Array.from(freshPlan.semanticIds).filter(
      (semantic) => semantic === CurveCrawlerMeshSemantic.EmergenceEgg,
    )).toHaveLength(freshPlan.emergence.eggVertexCount);
    expect(Array.from(freshPlan.semanticIds).filter(
      (semantic) => semantic === CurveCrawlerMeshSemantic.EmergenceShard,
    ).length).toBeGreaterThan(0);
    expect(Array.from(freshPlan.indices)).toEqual(Array.from(curveCrawlerMeshPlan.indices));
  });

  it('步态作为 Pose 成对更新 Position 和 Normal，且不改 Color 或局部索引', () => {
    const state = createCurveCrawlerMeshTestState(2);
    const range = createEntityRange(0, 2, 2);
    const streams = createCurveCrawlerMeshTestStreams(curveCrawlerMeshPlan, range.count);
    const indices = Array.from(curveCrawlerMeshPlan.indices);

    expect(curveCrawlerMeshEvaluator.evaluate(
      state,
      curveCrawlerMeshPlan,
      streams,
      range,
      MeshDirty.All,
    )).toBe(MeshDirty.All);
    expect(Array.from(streams.positions).every(Number.isFinite)).toBe(true);
    expect(Array.from(streams.normals).every(Number.isFinite)).toBe(true);
    expectUnitNormals(
      streams.normals,
      0,
      curveCrawlerMeshPlan.liquid.vertexOffset,
    );

    const originalPositions = streams.positions.slice();
    const originalColors = streams.colors.slice();
    state.data.animation.phase[0] = (state.data.animation.phase[0] ?? 0) + 0.72;
    expect(curveCrawlerMeshEvaluator.evaluate(
      state,
      curveCrawlerMeshPlan,
      streams,
      range,
      MeshDirty.Geometry,
    )).toBe(MeshDirty.Geometry);

    expect(Array.from(curveCrawlerMeshPlan.indices)).toEqual(indices);
    expect(Array.from(streams.positions)).not.toEqual(Array.from(originalPositions));
    expect(Array.from(streams.colors)).toEqual(Array.from(originalColors));
  });

  it('步态、眨眼、爆裂碎块和液体展开均直接求值为有限顶点', () => {
    const state = createCurveCrawlerMeshTestState(1);
    const range = createEntityRange(0, 1, 1);
    const streams = createCurveCrawlerMeshTestStreams(curveCrawlerMeshPlan, range.count);
    state.data.animation.phase[0] = 1.14;
    state.data.animation.bodyPulse[0] = 0.04;
    state.data.animation.crouchAmount[0] = 0.34;
    state.data.animation.biteAmount[0] = 0.83;
    state.data.animation.turnAmount[0] = 0.62;
    state.data.animation.turnDirection[0] = -1;
    state.data.animation.blinkScale[0] = 0.26;
    state.data.animation.surfaceCollapse[0] = 0.56;
    state.data.animation.liquidSpread[0] = 0.82;
    state.data.animation.liquidDrain[0] = 0.28;
    state.data.vitality.state[0] = MonsterLifecycleState.Dying;
    for (let fragment = 0; fragment < 12; fragment++) {
      state.data.animation.fragmentOffsetX[fragment] = fragment * 0.07 - 0.25;
      state.data.animation.fragmentOffsetY[fragment] = 0.19 - fragment * 0.04;
      state.data.animation.fragmentOffsetZ[fragment] = fragment * 0.03;
      state.data.animation.fragmentRotation[fragment] = fragment * 0.11;
    }

    expect(curveCrawlerMeshEvaluator.evaluate(
      state,
      curveCrawlerMeshPlan,
      streams,
      range,
      MeshDirty.Pose,
    )).toBe(MeshDirty.Pose);
    expect(Array.from(streams.positions).every(Number.isFinite)).toBe(true);
    expect(Array.from(streams.normals).every(Number.isFinite)).toBe(true);
    expectUnitNormals(
      streams.normals,
      0,
      curveCrawlerMeshPlan.emergence.vertexOffset,
    );
    expect(Math.max(...streams.positions)).toBeGreaterThan(1);
  });

  it('受击闪烁和液化收拢只改写语义颜色流', () => {
    const state = createCurveCrawlerMeshTestState(1);
    const range = createEntityRange(0, 1, 1);
    const streams = createCurveCrawlerMeshTestStreams(curveCrawlerMeshPlan, range.count);
    curveCrawlerMeshEvaluator.evaluate(
      state,
      curveCrawlerMeshPlan,
      streams,
      range,
      MeshDirty.All,
    );
    const positions = streams.positions.slice();
    const normals = streams.normals.slice();
    state.data.animation.hitFlash[0] = 1;
    state.data.animation.liquidDrain[0] = 1;

    expect(curveCrawlerMeshEvaluator.evaluate(
      state,
      curveCrawlerMeshPlan,
      streams,
      range,
      MeshDirty.Color,
    )).toBe(MeshDirty.Color);
    expect(Array.from(streams.positions)).toEqual(Array.from(positions));
    expect(Array.from(streams.normals)).toEqual(Array.from(normals));

    expect(streams.colors[0]).toBeCloseTo(1, 6);
    expect(streams.colors[1]).toBeCloseTo(12 / 255, 6);
    const eyeColorOffset = curveCrawlerMeshPlan.eyes.vertexOffset * 4;
    expect(streams.colors[eyeColorOffset]).toBeCloseTo(1, 6);
    expect(streams.colors[eyeColorOffset + 2]).toBeCloseTo(7 / 255, 6);
    const liquidColorOffset = curveCrawlerMeshPlan.liquid.vertexOffset * 4;
    expect(streams.colors[liquidColorOffset]).toBeCloseTo(8 / 255, 6);
    expect(streams.colors[liquidColorOffset + 1]).toBeCloseTo(30 / 255, 6);
  });

  it('拒绝只更新 Position 或 Normal 的半套姿态请求', () => {
    const state = createCurveCrawlerMeshTestState(1);
    const range = createEntityRange(0, 1, 1);
    const streams = createCurveCrawlerMeshTestStreams(curveCrawlerMeshPlan, range.count);

    expect(() => curveCrawlerMeshEvaluator.evaluate(
      state,
      curveCrawlerMeshPlan,
      streams,
      range,
      MeshDirty.Position,
    )).toThrow('Position 和 Normal');
    expect(() => curveCrawlerMeshEvaluator.evaluate(
      state,
      curveCrawlerMeshPlan,
      streams,
      range,
      MeshDirty.Normal,
    )).toThrow('Position 和 Normal');
  });

  it('完全坍缩只退化身体和双眼位置，保持局部索引并保留液体语义', () => {
    const state = createCurveCrawlerMeshTestState(1);
    const range = createEntityRange(0, 1, 1);
    const streams = createCurveCrawlerMeshTestStreams(curveCrawlerMeshPlan, range.count);
    state.data.animation.surfaceCollapse[0] = 1;
    state.data.animation.liquidSpread[0] = 1;
    state.data.vitality.state[0] = MonsterLifecycleState.Dying;
    const indices = Array.from(curveCrawlerMeshPlan.indices);

    curveCrawlerMeshEvaluator.evaluate(
      state,
      curveCrawlerMeshPlan,
      streams,
      range,
      MeshDirty.Geometry,
    );

    for (let vertex = 0; vertex < curveCrawlerMeshPlan.liquid.vertexOffset; vertex++) {
      const offset = vertex * 3;
      expect(streams.positions[offset]).toBeCloseTo(state.data.transform.x[0] ?? 0, 6);
      expect(streams.positions[offset + 1]).toBeCloseTo(state.data.transform.y[0] ?? 0, 6);
      expect(streams.positions[offset + 2]).toBeCloseTo(0, 6);
    }
    const liquidCenterOffset = curveCrawlerMeshPlan.liquid.vertexOffset * 3;
    expect(streams.positions[liquidCenterOffset + 2]).toBeCloseTo(0.035, 6);
    expect(Array.from(curveCrawlerMeshPlan.indices)).toEqual(indices);
  });
});

/** 断言全部法线都是有限单位向量。 */
function expectUnitNormals(
  normals: Float32Array,
  startVertex = 0,
  endVertex = normals.length / 3,
): void {
  for (let offset = startVertex * 3; offset < endVertex * 3; offset += 3) {
    expect(Math.hypot(
      normals[offset] ?? 0,
      normals[offset + 1] ?? 0,
      normals[offset + 2] ?? 0,
    )).toBeCloseTo(1, 4);
  }
}
