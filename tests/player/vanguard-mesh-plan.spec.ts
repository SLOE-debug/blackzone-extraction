import { describe, expect, it } from 'vitest';
import { createEntityRange } from '../../assets/core/entities/entity-range';
import {
  createSurfaceGeometry,
  GeometryIndexFormat,
  type SurfaceBufferGeometry,
} from '../../assets/core/geometry/buffer-geometry';
import { MeshDirty } from '../../assets/core/mesh/mesh-dirty';
import { createVertexStreams } from '../../assets/core/mesh/vertex-streams';
import { VanguardAnimationSystem } from '../../assets/player/vanguard/animation/vanguard-animation-system';
import {
  type VanguardCageDefinition,
} from '../../assets/player/vanguard/geometry/vanguard-cage';
import { compileVanguardMeshPlan } from '../../assets/player/vanguard/geometry/vanguard-mesh-compiler';
import { VANGUARD_MATTE_CAGE } from '../../assets/player/vanguard/geometry/vanguard-model-cage';
import { VanguardMeshEvaluator } from '../../assets/player/vanguard/geometry/vanguard-mesh-evaluator';
import { type VanguardMeshPlan } from '../../assets/player/vanguard/geometry/vanguard-mesh-plan';
import {
  VANGUARD_MATTE_MESH_PLAN,
  VANGUARD_TOTAL_TRIANGLE_COUNT,
} from '../../assets/player/vanguard/geometry/vanguard-mesh-plans';
import { VanguardMatteSurface } from '../../assets/player/vanguard/geometry/vanguard-surface';
import { VanguardAction } from '../../assets/player/vanguard/model/vanguard-action';
import { type VanguardPopulationOptions } from '../../assets/player/vanguard/model/vanguard-options';
import { VanguardState } from '../../assets/player/vanguard/model/vanguard-state';
import { VANGUARD_MATTE_MESH_PALETTE } from '../../assets/player/vanguard/rendering/vanguard-mesh-palette';

const TEST_OPTIONS = Object.freeze({
  position: Object.freeze({ x: 0, y: 0.72, z: -2 }),
  heading: 0,
  action: VanguardAction.Idle,
}) satisfies VanguardPopulationOptions;

describe('主角编译式网格计划', () => {
  it('在初始化期展开固定索引、语义跨度和 FacetedQuad 派生中心', () => {
    const plan = VANGUARD_MATTE_MESH_PLAN;

    expect(VANGUARD_TOTAL_TRIANGLE_COUNT).toBeGreaterThanOrEqual(500);
    expect(VANGUARD_TOTAL_TRIANGLE_COUNT).toBeLessThanOrEqual(700);
    expect(plan.vertexCount).toBe(plan.indexCount);
    expect(plan.indexCount % 3).toBe(0);
    expect(plan.facetedCenterA.length).toBeGreaterThan(0);
    expect(plan.semanticIds.length).toBe(plan.vertexCount);
    expect(plan.colorVariantIds.length).toBe(plan.vertexCount);
    expect(plan.semanticSpans).toHaveLength(VanguardMatteSurface.Count);
    expect(plan.semanticSpans.reduce((count, span) => count + span.vertexCount, 0))
      .toBe(plan.vertexCount);
    expect(Array.from(plan.indices).every((index) => index < plan.vertexCount)).toBe(true);
  });

  it('拒绝与实际面片不一致的表面三角形声明', () => {
    const surfaceTriangleCounts = [...VANGUARD_MATTE_CAGE.surfaceTriangleCounts];
    surfaceTriangleCounts[0] = (surfaceTriangleCounts[0] ?? 0) + 1;
    const malformed: VanguardCageDefinition = Object.freeze({
      ...VANGUARD_MATTE_CAGE,
      surfaceTriangleCounts: Object.freeze(surfaceTriangleCounts),
    });

    expect(() => compileVanguardMeshPlan(malformed, VanguardMatteSurface.Count))
      .toThrow('表面三角形数量不一致');
  });

  it('绑定姿态的每个独立三角形都保持有限的正确硬分面法线', () => {
    const fixture = createFixture();
    const geometry = evaluatePlan(
      fixture.state,
      VANGUARD_MATTE_MESH_PLAN,
      new VanguardMeshEvaluator(VANGUARD_MATTE_MESH_PLAN, VANGUARD_MATTE_MESH_PALETTE),
      MeshDirty.All,
    );

    expectFlatNormalsMatchTriangles(geometry);
    expect(geometry.getPositionView().every(Number.isFinite)).toBe(true);
    expect(geometry.getNormalView().every(Number.isFinite)).toBe(true);
  });

  it('姿态更新只改写位置和法线，不改写初始化烘焙的顶点色', () => {
    const fixture = createFixture();
    const evaluator = new VanguardMeshEvaluator(
      VANGUARD_MATTE_MESH_PLAN,
      VANGUARD_MATTE_MESH_PALETTE,
    );
    const geometry = evaluatePlan(
      fixture.state,
      VANGUARD_MATTE_MESH_PLAN,
      evaluator,
      MeshDirty.All,
    );
    const originalColors = Array.from(geometry.getColorView());
    const originalPositions = Array.from(geometry.getPositionView());

    fixture.animation.update(fixture.state, 0.5);
    const changed = evaluator.evaluate(
      fixture.state,
      VANGUARD_MATTE_MESH_PLAN,
      createVertexStreams(geometry),
      createEntityRange(0, fixture.state.count, fixture.state.count),
      MeshDirty.Position | MeshDirty.Normal,
    );

    expect(changed).toBe(MeshDirty.Position | MeshDirty.Normal);
    expect(Array.from(geometry.getColorView())).toEqual(originalColors);
    expect(Array.from(geometry.getPositionView())).not.toEqual(originalPositions);
  });

  it('将姿态位置和法线视为不可拆分的成对流', () => {
    const fixture = createFixture();
    const evaluator = new VanguardMeshEvaluator(
      VANGUARD_MATTE_MESH_PLAN,
      VANGUARD_MATTE_MESH_PALETTE,
    );
    const geometry = evaluatePlan(
      fixture.state,
      VANGUARD_MATTE_MESH_PLAN,
      evaluator,
      MeshDirty.All,
    );
    const originalPositions = Array.from(geometry.getPositionView());
    const originalNormals = Array.from(geometry.getNormalView());
    const range = createEntityRange(0, fixture.state.count, fixture.state.count);

    fixture.animation.update(fixture.state, 0.5);
    expect(() => evaluator.evaluate(
      fixture.state,
      VANGUARD_MATTE_MESH_PLAN,
      createVertexStreams(geometry),
      range,
      MeshDirty.Position,
    )).toThrow('同时请求');
    expect(() => evaluator.evaluate(
      fixture.state,
      VANGUARD_MATTE_MESH_PLAN,
      createVertexStreams(geometry),
      range,
      MeshDirty.Normal,
    )).toThrow('同时请求');
    expect(Array.from(geometry.getPositionView())).toEqual(originalPositions);
    expect(Array.from(geometry.getNormalView())).toEqual(originalNormals);

    expect(evaluator.evaluate(
      fixture.state,
      VANGUARD_MATTE_MESH_PLAN,
      createVertexStreams(geometry),
      range,
      MeshDirty.Pose,
    )).toBe(MeshDirty.Pose);
    expect(Array.from(geometry.getPositionView())).not.toEqual(originalPositions);
    expect(Array.from(geometry.getNormalView())).not.toEqual(originalNormals);
    expectFlatNormalsMatchTriangles(geometry);
  });

  it('按编译语义写入皮肤、衣物、披肩和确定性分面变化', () => {
    const fixture = createFixture();
    const matte = evaluatePlan(
      fixture.state,
      VANGUARD_MATTE_MESH_PLAN,
      new VanguardMeshEvaluator(VANGUARD_MATTE_MESH_PLAN, VANGUARD_MATTE_MESH_PALETTE),
      MeshDirty.All,
    );
    const skin = getColor(matte, getSpan(VANGUARD_MATTE_MESH_PLAN, VanguardMatteSurface.Skin)
      .startVertex);
    const tunic = getColor(matte, getSpan(VANGUARD_MATTE_MESH_PLAN, VanguardMatteSurface.Tunic)
      .startVertex);
    const mantle = getColor(matte, getSpan(VANGUARD_MATTE_MESH_PLAN, VanguardMatteSurface.Mantle)
      .startVertex);
    const skinSpan = getSpan(VANGUARD_MATTE_MESH_PLAN, VanguardMatteSurface.Skin);

    expect(skin.red).toBeGreaterThan(skin.blue * 1.7);
    expect(tunic.blue).toBeGreaterThan(tunic.red * 2.5);
    expect(mantle.red).toBeGreaterThan(mantle.blue * 2.5);
    expect(getColorChannelSpread(matte, skinSpan.startVertex, skinSpan.vertexCount, 0))
      .toBeGreaterThan(0.01);
  });

  it('用宽檐帽和左长右短的披风建立成熟远景轮廓', () => {
    const fixture = createFixture();
    const matte = evaluatePlan(
      fixture.state,
      VANGUARD_MATTE_MESH_PLAN,
      new VanguardMeshEvaluator(VANGUARD_MATTE_MESH_PLAN, VANGUARD_MATTE_MESH_PALETTE),
      MeshDirty.All,
    );
    const headwear = getAxisExtent(
      matte,
      getSpan(VANGUARD_MATTE_MESH_PLAN, VanguardMatteSurface.Headwear),
      0,
    );
    const mantleX = getAxisExtent(
      matte,
      getSpan(VANGUARD_MATTE_MESH_PLAN, VanguardMatteSurface.Mantle),
      0,
    );
    const mantleY = getAxisExtent(
      matte,
      getSpan(VANGUARD_MATTE_MESH_PLAN, VanguardMatteSurface.Mantle),
      1,
    );

    expect(headwear.maximum - headwear.minimum).toBeGreaterThan(1.3);
    expect(headwear.maximum - headwear.minimum).toBeLessThan(1.5);
    expect(-mantleX.minimum).toBeGreaterThan(mantleX.maximum + 0.15);
    expect(mantleY.maximum - mantleY.minimum).toBeGreaterThan(1.05);
  });

  it('计划求值不会重写固定索引或语义数据', () => {
    const fixture = createFixture();
    const evaluator = new VanguardMeshEvaluator(
      VANGUARD_MATTE_MESH_PLAN,
      VANGUARD_MATTE_MESH_PALETTE,
    );
    const indices = Array.from(VANGUARD_MATTE_MESH_PLAN.indices);
    const semantics = Array.from(VANGUARD_MATTE_MESH_PLAN.semanticIds);

    evaluatePlan(fixture.state, VANGUARD_MATTE_MESH_PLAN, evaluator, MeshDirty.All);
    fixture.animation.update(fixture.state, 0.25);
    evaluatePlan(fixture.state, VANGUARD_MATTE_MESH_PLAN, evaluator, MeshDirty.Pose);

    expect(Array.from(VANGUARD_MATTE_MESH_PLAN.indices)).toEqual(indices);
    expect(Array.from(VANGUARD_MATTE_MESH_PLAN.semanticIds)).toEqual(semantics);
  });
});

/** 创建绑定姿态已写入的单实体主角状态。 */
function createFixture(): { readonly state: VanguardState; readonly animation: VanguardAnimationSystem } {
  const state = new VanguardState(TEST_OPTIONS);
  const animation = new VanguardAnimationSystem();
  animation.initialize(state);
  return { state, animation };
}

/** 为一个单实体计划分配流并按请求属性求值。 */
function evaluatePlan(
  state: VanguardState,
  plan: VanguardMeshPlan,
  evaluator: VanguardMeshEvaluator,
  dirty: MeshDirty,
): SurfaceBufferGeometry {
  const geometry = createSurfaceGeometry(plan.vertexCount, plan.indexCount, GeometryIndexFormat.Uint16);
  geometry.index.set(plan.indices);
  geometry.commitCounts(plan.vertexCount, plan.indexCount);
  evaluator.evaluate(
    state,
    plan,
    createVertexStreams(geometry),
    createEntityRange(0, state.count, state.count),
    dirty,
  );
  return geometry;
}

/** 返回指定表面语义的编译连续跨度。 */
function getSpan(plan: VanguardMeshPlan, semantic: number): Readonly<{ startVertex: number; vertexCount: number }> {
  const span = plan.semanticSpans[semantic];
  if (span === undefined) {
    throw new Error(`主角编译语义跨度不存在：${semantic}`);
  }
  return span;
}

/** 验证每组三个独立顶点的法线等于相同三角形位置叉积方向。 */
function expectFlatNormalsMatchTriangles(geometry: SurfaceBufferGeometry): void {
  for (let vertex = 0; vertex < geometry.vertexCount; vertex += 3) {
    const offset = vertex * 3;
    const ax = geometry.positions[offset] ?? 0;
    const ay = geometry.positions[offset + 1] ?? 0;
    const az = geometry.positions[offset + 2] ?? 0;
    const abX = (geometry.positions[offset + 3] ?? 0) - ax;
    const abY = (geometry.positions[offset + 4] ?? 0) - ay;
    const abZ = (geometry.positions[offset + 5] ?? 0) - az;
    const acX = (geometry.positions[offset + 6] ?? 0) - ax;
    const acY = (geometry.positions[offset + 7] ?? 0) - ay;
    const acZ = (geometry.positions[offset + 8] ?? 0) - az;
    const normalLength = Math.hypot(
      abY * acZ - abZ * acY,
      abZ * acX - abX * acZ,
      abX * acY - abY * acX,
    );
    expect(normalLength).toBeGreaterThan(0.000001);
    const expectedX = (abY * acZ - abZ * acY) / normalLength;
    const expectedY = (abZ * acX - abX * acZ) / normalLength;
    const expectedZ = (abX * acY - abY * acX) / normalLength;
    for (let corner = 0; corner < 3; corner++) {
      const normalOffset = (vertex + corner) * 3;
      expect(geometry.normals[normalOffset] ?? 0).toBeCloseTo(expectedX, 4);
      expect(geometry.normals[normalOffset + 1] ?? 0).toBeCloseTo(expectedY, 4);
      expect(geometry.normals[normalOffset + 2] ?? 0).toBeCloseTo(expectedZ, 4);
    }
  }
}

/** 读取一个顶点的 RGB 颜色。 */
function getColor(
  geometry: SurfaceBufferGeometry,
  vertex: number,
): Readonly<{ red: number; green: number; blue: number }> {
  const offset = vertex * 4;
  return Object.freeze({
    red: geometry.colors[offset] ?? 0,
    green: geometry.colors[offset + 1] ?? 0,
    blue: geometry.colors[offset + 2] ?? 0,
  });
}

/** 计算连续顶点范围中一个颜色通道的最大差值。 */
function getColorChannelSpread(
  geometry: SurfaceBufferGeometry,
  startVertex: number,
  vertexCount: number,
  channel: 0 | 1 | 2,
): number {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (let vertex = startVertex; vertex < startVertex + vertexCount; vertex++) {
    const value = geometry.colors[vertex * 4 + channel] ?? 0;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  return maximum - minimum;
}

/** 返回语义跨度在目标坐标轴上的最小值与最大值。 */
function getAxisExtent(
  geometry: SurfaceBufferGeometry,
  span: Readonly<{ startVertex: number; vertexCount: number }>,
  axis: 0 | 1 | 2,
): Readonly<{ minimum: number; maximum: number }> {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  const endVertex = span.startVertex + span.vertexCount;
  for (let vertex = span.startVertex; vertex < endVertex; vertex++) {
    const value = geometry.positions[vertex * 3 + axis] ?? 0;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  return Object.freeze({ minimum, maximum });
}
