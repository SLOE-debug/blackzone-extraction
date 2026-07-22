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
  CurveCrawlerPackedMeshUpdate,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-packed-mesh-update';
import {
  CurveCrawlerMeshSemantic,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/geometry/curve-crawler-mesh-plan';
import {
  shadeCurveCrawlerUnlitEntities,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-unlit-vertex-shading';
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

  it('共享 Unlit 路径把 CPU 法线烘成身体分档明暗并保持眼睛清晰', () => {
    const state = createCurveCrawlerMeshTestState(1);
    const streams = createCurveCrawlerMeshTestStreams(curveCrawlerMeshPlan, 1);
    curveCrawlerMeshEvaluator.evaluate(
      state,
      curveCrawlerMeshPlan,
      streams,
      createEntityRange(0, 1, 1),
      MeshDirty.All,
    );
    const baseColors = streams.colors.slice();

    shadeCurveCrawlerUnlitEntities(streams, curveCrawlerMeshPlan, 0, 1);

    const legStart = curveCrawlerMeshPlan.body.legVertexOffsets[0] ?? 0;
    const legEnd = legStart + curveCrawlerMeshPlan.legTube.vertexCount;
    const legRedLevels = new Set<number>();
    for (let vertex = legStart; vertex < legEnd; vertex++) {
      const colorOffset = vertex * 4;
      const shadedRed = streams.colors[colorOffset] ?? 0;
      const baseRed = baseColors[colorOffset] ?? 0;
      legRedLevels.add(Number(shadedRed.toFixed(5)));
      expect(shadedRed).toBeGreaterThanOrEqual(baseRed * 0.64 - 0.000001);
      expect(shadedRed).toBeLessThanOrEqual(baseRed * 0.88 + 0.000001);
      expect(streams.colors[vertex * 4 + 3]).toBe(1);
    }
    expect(legRedLevels.size).toBeGreaterThan(1);

    const eyeColorOffset = curveCrawlerMeshPlan.eyes.vertexOffset * 4;
    expect(streams.colors[eyeColorOffset] ?? 0).toBeLessThanOrEqual(
      baseColors[eyeColorOffset] ?? 0,
    );
    expect(streams.colors[eyeColorOffset] ?? 0).toBeGreaterThan(
      (baseColors[eyeColorOffset] ?? 0) * 0.8,
    );
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

  it('按驻留槽位清单把离散实体紧凑写入连续网格', () => {
    const state = createCurveCrawlerMeshTestState(3);
    const complete = createCurveCrawlerMeshTestStreams(curveCrawlerMeshPlan, 3);
    curveCrawlerMeshEvaluator.evaluate(
      state,
      curveCrawlerMeshPlan,
      complete,
      createEntityRange(0, 3, 3),
      MeshDirty.All,
    );

    const packed = createCurveCrawlerMeshTestStreams(curveCrawlerMeshPlan, 2);
    const indices = Uint32Array.of(2, 0, 1);
    expect(curveCrawlerMeshEvaluator.evaluatePacked(
      state,
      curveCrawlerMeshPlan,
      packed,
      indices,
      2,
      0,
      MeshDirty.All,
    )).toBe(MeshDirty.All);

    const positionStride = curveCrawlerMeshPlan.vertexCount * 3;
    const colorStride = curveCrawlerMeshPlan.vertexCount * 4;
    expect(packed.positions.subarray(0, positionStride)).toEqual(
      complete.positions.subarray(positionStride * 2, positionStride * 3),
    );
    expect(packed.positions.subarray(positionStride, positionStride * 2)).toEqual(
      complete.positions.subarray(0, positionStride),
    );
    expect(packed.normals.subarray(0, positionStride)).toEqual(
      complete.normals.subarray(positionStride * 2, positionStride * 3),
    );
    expect(packed.colors.subarray(0, colorStride)).toEqual(
      complete.colors.subarray(colorStride * 2, colorStride * 3),
    );
  });

  it('脏区求值只重写被调度实体并把颜色职责限制到单独槽位', () => {
    const state = createCurveCrawlerMeshTestState(3);
    const streams = createCurveCrawlerMeshTestStreams(curveCrawlerMeshPlan, 3);
    streams.positions.fill(-99);
    streams.normals.fill(-99);
    streams.colors.fill(0.5);
    state.data.animation.hitFlash[2] = 1;
    const updates = Uint8Array.of(
      CurveCrawlerPackedMeshUpdate.Position,
      CurveCrawlerPackedMeshUpdate.None,
      CurveCrawlerPackedMeshUpdate.Shaded,
    );

    expect(curveCrawlerMeshEvaluator.evaluatePackedScheduled(
      state,
      curveCrawlerMeshPlan,
      streams,
      Uint32Array.of(0, 1, 2),
      updates,
      3,
      0,
    )).toBe(MeshDirty.Position | MeshDirty.Color);

    const positionStride = curveCrawlerMeshPlan.vertexCount * 3;
    const colorStride = curveCrawlerMeshPlan.vertexCount * 4;
    expect(streams.positions[0]).not.toBe(-99);
    expect(Array.from(streams.positions.subarray(positionStride, positionStride * 2)))
      .toEqual(Array.from(new Float32Array(positionStride).fill(-99)));
    expect(streams.colors[0]).toBe(0.5);
    expect(streams.colors[colorStride * 2]).not.toBe(0.5);
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
