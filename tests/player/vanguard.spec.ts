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
import { VANGUARD_BODY_CAGE } from '../../assets/player/vanguard/geometry/vanguard-body-cage';
import { type VanguardCagePatch } from '../../assets/player/vanguard/geometry/vanguard-cage';
import {
  VanguardMeshEvaluator,
  type VanguardMeshPalette,
} from '../../assets/player/vanguard/geometry/vanguard-mesh-evaluator';
import { type VanguardMeshPlan } from '../../assets/player/vanguard/geometry/vanguard-mesh-plan';
import {
  VANGUARD_MATTE_MESH_PLAN,
  VANGUARD_METAL_MESH_PLAN,
  VANGUARD_TOTAL_TRIANGLE_COUNT,
} from '../../assets/player/vanguard/geometry/vanguard-mesh-plans';
import { VanguardMatteSurface, VanguardMetalSurface } from '../../assets/player/vanguard/geometry/vanguard-surface';
import { VANGUARD_ANATOMY } from '../../assets/player/vanguard/model/vanguard-anatomy';
import { VanguardAction } from '../../assets/player/vanguard/model/vanguard-action';
import { type VanguardPopulationOptions } from '../../assets/player/vanguard/model/vanguard-options';
import { VanguardState } from '../../assets/player/vanguard/model/vanguard-state';
import {
  VANGUARD_MATTE_MESH_PALETTE,
  VANGUARD_METAL_MESH_PALETTE,
} from '../../assets/player/vanguard/rendering/vanguard-mesh-palette';

const TEST_BASE_Y = 0.72;
const TEST_FOCUS_Z = -2;
const TEST_OPTIONS = Object.freeze({
  position: Object.freeze({ x: 0, y: TEST_BASE_Y, z: TEST_FOCUS_Z }),
  heading: 0,
  action: VanguardAction.ShrugAndTurnHead,
}) satisfies VanguardPopulationOptions;

describe('可复用正面 Low Poly 人类英雄', () => {
  it('主体拓扑保持单一连通且不依赖封闭管段拼接', () => {
    const adjacency = Array.from(
      { length: VANGUARD_BODY_CAGE.vertices.length },
      () => new Set<number>(),
    );
    for (const patch of VANGUARD_BODY_CAGE.patches) {
      connectPatch(adjacency, patch);
    }
    const visited = new Set<number>();
    const pending = [0];
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === undefined || visited.has(current)) {
        continue;
      }
      visited.add(current);
      for (const neighbor of adjacency[current] ?? []) {
        pending.push(neighbor);
      }
    }
    expect(visited.size).toBe(VANGUARD_BODY_CAGE.vertices.length);
    for (const patch of VANGUARD_BODY_CAGE.patches) {
      expect(new Set([patch.a, patch.b, patch.c]).size).toBe(3);
    }
  });

  it('保持正面人类英雄的头身、肩腰和双腿比例', () => {
    const fixture = createVanguardFixture();
    const matte = evaluatePlan(
      fixture.state,
      VANGUARD_MATTE_MESH_PLAN,
      VANGUARD_MATTE_MESH_PALETTE,
    );
    const minimumY = getMinimum(matte.positions, matte.vertexCount, 1);
    const maximumY = getMaximum(matte.positions, matte.vertexCount, 1);
    const height = maximumY - minimumY;
    const headRatio = (VANGUARD_ANATOMY.height - 3.2) / VANGUARD_ANATOMY.height;
    const shoulderWidth = getWidthAtHeight(matte, TEST_BASE_Y + 2.82, 0.09);
    const waistWidth = getWidthAtHeight(matte, TEST_BASE_Y + 2.03, 0.08, 0.6);
    const thighWidth = getWidthAtHeight(matte, TEST_BASE_Y + 1.3, 0.1);
    const faceFront = getMaximum(matte.positions, matte.vertexCount, 2) - TEST_FOCUS_Z;
    const headBack = getMinimum(matte.positions, matte.vertexCount, 2) - TEST_FOCUS_Z;
    const leftFoot = getMinimumXBelow(matte, TEST_BASE_Y + 0.17);
    const rightFoot = getMaximumXBelow(matte, TEST_BASE_Y + 0.17);

    expect(height).toBeGreaterThan(3.75);
    expect(height).toBeLessThan(4.15);
    expect(headRatio).toBeGreaterThan(0.13);
    expect(headRatio).toBeLessThan(0.17);
    expect(shoulderWidth).toBeGreaterThan(1.15);
    expect(shoulderWidth).toBeLessThan(1.4);
    expect(waistWidth).toBeLessThan(0.85);
    expect(shoulderWidth).toBeGreaterThan(waistWidth * 1.35);
    expect(thighWidth).toBeGreaterThan(0.85);
    expect(shoulderWidth).toBeLessThan(thighWidth * 1.45);
    expect(faceFront).toBeGreaterThan(0.36);
    expect(headBack).toBeLessThan(-0.22);
    expect(leftFoot).toBeLessThan(-0.28);
    expect(rightFoot).toBeGreaterThan(0.28);
    expect(minimumY).toBeGreaterThanOrEqual(TEST_BASE_Y + 0.035);
  });

  it('待机动作移动头部、围巾和长剑，同时保持脚底稳定', () => {
    const fixture = createVanguardFixture();
    const matteBefore = evaluatePlan(
      fixture.state,
      VANGUARD_MATTE_MESH_PLAN,
      VANGUARD_MATTE_MESH_PALETTE,
    );
    const metalBefore = evaluatePlan(
      fixture.state,
      VANGUARD_METAL_MESH_PLAN,
      VANGUARD_METAL_MESH_PALETTE,
    );
    const beforeMinimumY = getMinimum(matteBefore.positions, matteBefore.vertexCount, 1);
    const beforeMaximumY = getMaximum(matteBefore.positions, matteBefore.vertexCount, 1);
    const beforeSwordX = getMaximum(metalBefore.positions, metalBefore.vertexCount, 0);

    fixture.animation.update(fixture.state, 0.5);
    const matteAfter = evaluatePlan(
      fixture.state,
      VANGUARD_MATTE_MESH_PLAN,
      VANGUARD_MATTE_MESH_PALETTE,
    );
    const metalAfter = evaluatePlan(
      fixture.state,
      VANGUARD_METAL_MESH_PLAN,
      VANGUARD_METAL_MESH_PALETTE,
    );
    const changedVertices = countChangedVertices(matteBefore.positions, matteAfter.positions);

    expect(changedVertices).toBeGreaterThan(matteAfter.vertexCount * 0.2);
    expect(getMinimum(matteAfter.positions, matteAfter.vertexCount, 1)).toBeCloseTo(
      beforeMinimumY,
      4,
    );
    expect(getMaximum(matteAfter.positions, matteAfter.vertexCount, 1)).not.toBeCloseTo(
      beforeMaximumY,
      4,
    );
    expect(getMaximum(metalAfter.positions, metalAfter.vertexCount, 0)).not.toBeCloseTo(
      beforeSwordX,
      4,
    );
  });

  it('固定生成目标面数、单位法线和完全一致的编译拓扑位置', () => {
    const fixture = createVanguardFixture();
    const firstMatte = evaluatePlan(
      fixture.state,
      VANGUARD_MATTE_MESH_PLAN,
      VANGUARD_MATTE_MESH_PALETTE,
    );
    const secondMatte = evaluatePlan(
      fixture.state,
      VANGUARD_MATTE_MESH_PLAN,
      VANGUARD_MATTE_MESH_PALETTE,
    );
    const metal = evaluatePlan(
      fixture.state,
      VANGUARD_METAL_MESH_PLAN,
      VANGUARD_METAL_MESH_PALETTE,
    );

    expect(VANGUARD_TOTAL_TRIANGLE_COUNT).toBeGreaterThanOrEqual(550);
    expect(VANGUARD_TOTAL_TRIANGLE_COUNT).toBeLessThanOrEqual(750);
    expect(firstMatte.vertexCount).toBe(VANGUARD_MATTE_MESH_PLAN.vertexCount);
    expect(firstMatte.indexCount).toBe(VANGUARD_MATTE_MESH_PLAN.indexCount);
    expect(metal.vertexCount).toBe(VANGUARD_METAL_MESH_PLAN.vertexCount);
    expect(metal.indexCount).toBe(VANGUARD_METAL_MESH_PLAN.indexCount);
    expect(Array.from(firstMatte.getPositionView())).toEqual(
      Array.from(secondMatte.getPositionView()),
    );
    expectUnitNormals(firstMatte.normals, firstMatte.vertexCount);
    expectUnitNormals(metal.normals, metal.vertexCount);
  });

  it('按皮肤、五官、衣物、围巾、皮革和金属写入编译语义颜色', () => {
    const fixture = createVanguardFixture();
    const matte = evaluatePlan(
      fixture.state,
      VANGUARD_MATTE_MESH_PLAN,
      VANGUARD_MATTE_MESH_PALETTE,
    );
    const metal = evaluatePlan(
      fixture.state,
      VANGUARD_METAL_MESH_PLAN,
      VANGUARD_METAL_MESH_PALETTE,
    );

    const skin = getColor(matte, getSurfaceSpan(VANGUARD_MATTE_MESH_PLAN, VanguardMatteSurface.Skin)
      .startVertex);
    const face = getColor(matte, getSurfaceSpan(VANGUARD_MATTE_MESH_PLAN, VanguardMatteSurface.FaceDetail)
      .startVertex);
    const tunic = getColor(matte, getSurfaceSpan(VANGUARD_MATTE_MESH_PLAN, VanguardMatteSurface.Tunic)
      .startVertex);
    const scarf = getColor(matte, getSurfaceSpan(VANGUARD_MATTE_MESH_PLAN, VanguardMatteSurface.Scarf)
      .startVertex);
    const leather = getColor(matte, getSurfaceSpan(VANGUARD_MATTE_MESH_PLAN, VanguardMatteSurface.Leather)
      .startVertex);
    const steel = getColor(metal, getSurfaceSpan(VANGUARD_METAL_MESH_PLAN, VanguardMetalSurface.Steel)
      .startVertex);
    const brass = getColor(metal, getSurfaceSpan(VANGUARD_METAL_MESH_PLAN, VanguardMetalSurface.Brass)
      .startVertex);

    expect(skin.red).toBeGreaterThan(skin.blue * 1.7);
    expect(face.red).toBeLessThan(skin.red * 0.35);
    expect(tunic.blue).toBeGreaterThan(tunic.red * 2.5);
    expect(scarf.red).toBeGreaterThan(scarf.blue * 2.5);
    expect(leather.red).toBeGreaterThan(leather.blue * 2);
    expect(Math.max(steel.red, steel.green, steel.blue)
      - Math.min(steel.red, steel.green, steel.blue)).toBeLessThan(0.12);
    expect(brass.red).toBeGreaterThan(brass.blue * 2.4);
  });

  it('颈部在围巾与下颌之间收腰，并避免高对比三角条纹', () => {
    const fixture = createVanguardFixture();
    const matte = evaluatePlan(
      fixture.state,
      VANGUARD_MATTE_MESH_PLAN,
      VANGUARD_MATTE_MESH_PALETTE,
    );
    const neckRange = getSurfaceSpan(VANGUARD_MATTE_MESH_PLAN, VanguardMatteSurface.NeckSkin);
    const skinRange = getSurfaceSpan(VANGUARD_MATTE_MESH_PLAN, VanguardMatteSurface.Skin);
    const neckBaseWidth = getRangeWidthAtHeight(matte, neckRange, TEST_BASE_Y + 3.05, 0.025);
    const neckUpperWidth = getRangeWidthAtHeight(matte, neckRange, TEST_BASE_Y + 3.19, 0.025);
    const jawWidth = getRangeWidthAtHeight(matte, neckRange, TEST_BASE_Y + 3.3, 0.035);
    const neckRedSpread = getColorChannelSpread(matte, neckRange, 0);
    const skinRedSpread = getColorChannelSpread(matte, skinRange, 0);

    expect(neckBaseWidth).toBeGreaterThan(neckUpperWidth * 1.15);
    expect(jawWidth).toBeGreaterThan(neckUpperWidth * 1.45);
    expect(neckRedSpread).toBeLessThan(0.000001);
    expect(neckRedSpread).toBeLessThan(skinRedSpread * 0.1);
  });
});

/** 创建完成初始骨骼姿态的单实体主角夹具。 */
function createVanguardFixture(): {
  readonly state: VanguardState;
  readonly animation: VanguardAnimationSystem;
} {
  const state = new VanguardState(TEST_OPTIONS);
  const animation = new VanguardAnimationSystem();
  animation.initialize(state);
  return { state, animation };
}

/** 为一个单实体编译计划分配运行时流并执行首次完整求值。 */
function evaluatePlan(
  state: VanguardState,
  plan: VanguardMeshPlan,
  palette: VanguardMeshPalette,
): SurfaceBufferGeometry {
  const geometry = createSurfaceGeometry(plan.vertexCount, plan.indexCount, GeometryIndexFormat.Uint16);
  geometry.index.set(plan.indices);
  geometry.commitCounts(plan.vertexCount, plan.indexCount);
  new VanguardMeshEvaluator(plan, palette).evaluate(
    state,
    plan,
    createVertexStreams(geometry),
    createEntityRange(0, state.count, state.count),
    MeshDirty.All,
  );
  return geometry;
}

/** 把面片所有角点加入无向连通图。 */
function connectPatch(adjacency: readonly Set<number>[], patch: Readonly<VanguardCagePatch>): void {
  const vertices = patch.d === patch.c
    ? [patch.a, patch.b, patch.c]
    : [patch.a, patch.b, patch.c, patch.d];
  for (let index = 0; index < vertices.length; index++) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    if (current === undefined || next === undefined) {
      throw new Error('测试面片顶点不存在。');
    }
    adjacency[current]?.add(next);
    adjacency[next]?.add(current);
  }
}

/** 验证全部硬分面顶点法线保持单位长度。 */
function expectUnitNormals(normals: Float32Array, vertexCount: number): void {
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const offset = vertex * 3;
    const length = Math.hypot(
      normals[offset] ?? 0,
      normals[offset + 1] ?? 0,
      normals[offset + 2] ?? 0,
    );
    expect(length).toBeCloseTo(1, 5);
  }
}

/** 返回指定轴分量的最小值。 */
function getMinimum(
  positions: Float32Array,
  vertexCount: number,
  axis: 0 | 1 | 2,
): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    minimum = Math.min(minimum, positions[vertex * 3 + axis] ?? 0);
  }
  return minimum;
}

/** 返回指定轴分量的最大值。 */
function getMaximum(
  positions: Float32Array,
  vertexCount: number,
  axis: 0 | 1 | 2,
): number {
  let maximum = Number.NEGATIVE_INFINITY;
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    maximum = Math.max(maximum, positions[vertex * 3 + axis] ?? 0);
  }
  return maximum;
}

/** 返回指定高度带中所有顶点的横向宽度。 */
function getWidthAtHeight(
  geometry: SurfaceBufferGeometry,
  centerY: number,
  halfRange: number,
  maximumAbsoluteX = Number.POSITIVE_INFINITY,
): number {
  let minimumX = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  for (let vertex = 0; vertex < geometry.vertexCount; vertex++) {
    const offset = vertex * 3;
    const y = geometry.positions[offset + 1] ?? 0;
    if (Math.abs(y - centerY) > halfRange) {
      continue;
    }
    const x = geometry.positions[offset] ?? 0;
    if (Math.abs(x) > maximumAbsoluteX) {
      continue;
    }
    minimumX = Math.min(minimumX, x);
    maximumX = Math.max(maximumX, x);
  }
  return maximumX - minimumX;
}

/** 返回指定语义顶点区段在某高度带中的横向宽度。 */
function getRangeWidthAtHeight(
  geometry: SurfaceBufferGeometry,
  range: Readonly<{ startVertex: number; vertexCount: number }>,
  centerY: number,
  halfRange: number,
): number {
  let minimumX = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  const endVertex = range.startVertex + range.vertexCount;
  for (let vertex = range.startVertex; vertex < endVertex; vertex++) {
    const offset = vertex * 3;
    const y = geometry.positions[offset + 1] ?? 0;
    if (Math.abs(y - centerY) > halfRange) {
      continue;
    }
    const x = geometry.positions[offset] ?? 0;
    minimumX = Math.min(minimumX, x);
    maximumX = Math.max(maximumX, x);
  }
  return maximumX - minimumX;
}

/** 返回指定高度以下的最小横向坐标。 */
function getMinimumXBelow(geometry: SurfaceBufferGeometry, maximumY: number): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (let vertex = 0; vertex < geometry.vertexCount; vertex++) {
    const offset = vertex * 3;
    if ((geometry.positions[offset + 1] ?? 0) <= maximumY) {
      minimum = Math.min(minimum, geometry.positions[offset] ?? 0);
    }
  }
  return minimum;
}

/** 返回指定高度以下的最大横向坐标。 */
function getMaximumXBelow(geometry: SurfaceBufferGeometry, maximumY: number): number {
  let maximum = Number.NEGATIVE_INFINITY;
  for (let vertex = 0; vertex < geometry.vertexCount; vertex++) {
    const offset = vertex * 3;
    if ((geometry.positions[offset + 1] ?? 0) <= maximumY) {
      maximum = Math.max(maximum, geometry.positions[offset] ?? 0);
    }
  }
  return maximum;
}

/** 统计两个固定拓扑位置缓冲中发生可见变化的顶点。 */
function countChangedVertices(before: Float32Array, after: Float32Array): number {
  let changed = 0;
  const vertexCount = Math.min(before.length, after.length) / 3;
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const offset = vertex * 3;
    const distance = Math.hypot(
      (after[offset] ?? 0) - (before[offset] ?? 0),
      (after[offset + 1] ?? 0) - (before[offset + 1] ?? 0),
      (after[offset + 2] ?? 0) - (before[offset + 2] ?? 0),
    );
    if (distance > 0.00001) {
      changed++;
    }
  }
  return changed;
}

/** 返回指定顶点的 RGB 颜色。 */
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

/** 返回指定语义范围颜色通道的最大跨度。 */
function getColorChannelSpread(
  geometry: SurfaceBufferGeometry,
  range: Readonly<{ startVertex: number; vertexCount: number }>,
  channel: 0 | 1 | 2,
): number {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  const endVertex = range.startVertex + range.vertexCount;
  for (let vertex = range.startVertex; vertex < endVertex; vertex++) {
    const value = geometry.colors[vertex * 4 + channel] ?? 0;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  return maximum - minimum;
}

/** 返回一个语义表面在已编译顶点流中的连续范围。 */
function getSurfaceSpan(
  plan: VanguardMeshPlan,
  semantic: number,
): Readonly<{ startVertex: number; vertexCount: number }> {
  const span = plan.semanticSpans[semantic];
  if (span === undefined) {
    throw new Error(`主角表面范围不存在：${semantic}`);
  }
  return span;
}
