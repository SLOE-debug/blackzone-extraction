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
import { VanguardMeshEvaluator } from '../../assets/player/vanguard/geometry/vanguard-mesh-evaluator';
import {
  VANGUARD_MATTE_MESH_PLAN,
} from '../../assets/player/vanguard/geometry/vanguard-mesh-plans';
import { VanguardMatteSurface } from '../../assets/player/vanguard/geometry/vanguard-surface';
import {
  VANGUARD_MANTLE_HALF_THICKNESS,
  VANGUARD_MANTLE_TRIANGLES,
} from '../../assets/player/vanguard/geometry/vanguard-mantle-topology';
import {
  VANGUARD_MANTLE_CONTROL_BINDING,
} from '../../assets/player/vanguard/geometry/vanguard-model-cage';
import { VanguardAction } from '../../assets/player/vanguard/model/vanguard-action';
import {
  VANGUARD_MANTLE_BACKSTOP_Z,
  VANGUARD_MANTLE_PARTICLE_COUNT,
  VANGUARD_MANTLE_PINNED,
} from '../../assets/player/vanguard/model/vanguard-mantle-particles';
import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
} from '../../assets/player/vanguard/model/vanguard-bone';
import { type VanguardPopulationOptions } from '../../assets/player/vanguard/model/vanguard-options';
import { VanguardState } from '../../assets/player/vanguard/model/vanguard-state';
import { VANGUARD_MATTE_MESH_PALETTE } from '../../assets/player/vanguard/rendering/vanguard-mesh-palette';
import { VANGUARD_MANTLE_CONSTRAINTS } from '../../assets/player/vanguard/simulation/vanguard-mantle-constraints';
import {
  VANGUARD_MANTLE_FIXED_STEP,
  VanguardMantleSimulationSystem,
} from '../../assets/player/vanguard/simulation/vanguard-mantle-system';

const TEST_OPTIONS = Object.freeze({
  position: Object.freeze({ x: 0, y: 0.72, z: -2 }),
  heading: 0,
  action: VanguardAction.Idle,
}) satisfies VanguardPopulationOptions;

describe('主角高性能柔性披风', () => {
  it('使用受限粒子、固定约束和一对正反厚度控制点', () => {
    expect(VANGUARD_MANTLE_PARTICLE_COUNT).toBe(13);
    expect(VANGUARD_MANTLE_TRIANGLES.length / 3).toBe(10);
    expect(VANGUARD_MANTLE_CONSTRAINTS.particleA.length).toBeLessThanOrEqual(40);
    expect(VANGUARD_MANTLE_CONTROL_BINDING.controlVertices)
      .toHaveLength(VANGUARD_MANTLE_PARTICLE_COUNT * 2);

    for (let particle = 0; particle < VANGUARD_MANTLE_PARTICLE_COUNT; particle++) {
      const offsets: number[] = [];
      for (let binding = 0;
        binding < VANGUARD_MANTLE_CONTROL_BINDING.particleIndices.length;
        binding++) {
        if ((VANGUARD_MANTLE_CONTROL_BINDING.particleIndices[binding] ?? -1) === particle) {
          offsets.push(VANGUARD_MANTLE_CONTROL_BINDING.normalOffsets[binding] ?? 0);
        }
      }
      expect(offsets).toHaveLength(2);
      expect(Math.min(...offsets)).toBeCloseTo(-VANGUARD_MANTLE_HALF_THICKNESS, 6);
      expect(Math.max(...offsets)).toBeCloseTo(VANGUARD_MANTLE_HALF_THICKNESS, 6);
    }
  });

  it('在相同步长和姿态输入下保持逐位确定，并产生可见柔性位移', () => {
    const first = createFixture();
    const second = createFixture();
    const initialX = Array.from(first.state.data.mantle.positionX);
    const initialY = Array.from(first.state.data.mantle.positionY);
    const initialZ = Array.from(first.state.data.mantle.positionZ);

    for (let frame = 0; frame < 180; frame++) {
      first.animation.update(first.state, VANGUARD_MANTLE_FIXED_STEP);
      second.animation.update(second.state, VANGUARD_MANTLE_FIXED_STEP);
      first.mantle.update(first.state, VANGUARD_MANTLE_FIXED_STEP);
      second.mantle.update(second.state, VANGUARD_MANTLE_FIXED_STEP);
    }

    expect(Array.from(first.state.data.mantle.positionX))
      .toEqual(Array.from(second.state.data.mantle.positionX));
    expect(Array.from(first.state.data.mantle.positionY))
      .toEqual(Array.from(second.state.data.mantle.positionY));
    expect(Array.from(first.state.data.mantle.positionZ))
      .toEqual(Array.from(second.state.data.mantle.positionZ));
    expect(getMaximumParticleTravel(first.state, initialX, initialY, initialZ))
      .toBeGreaterThan(0.03);
  });

  it('在持续位移和急转向中维持背挡与躯干碰撞壳', () => {
    const fixture = createFixture();
    const positionX = fixture.state.data.mantle.positionX;
    const previousX = fixture.state.data.mantle.previousX;

    for (let frame = 0; frame < 240; frame++) {
      fixture.state.data.transform.x[0] = (fixture.state.data.transform.x[0] ?? 0)
        + Math.sin(frame * 0.17) * 0.025;
      fixture.state.data.transform.z[0] = (fixture.state.data.transform.z[0] ?? 0) + 0.045;
      fixture.state.data.transform.heading[0] = (fixture.state.data.transform.heading[0] ?? 0)
        + 0.055;
      fixture.animation.update(fixture.state, VANGUARD_MANTLE_FIXED_STEP);
      fixture.mantle.update(fixture.state, VANGUARD_MANTLE_FIXED_STEP);
      expectParticlesOutsideTorsoAndBackstop(fixture.state);
    }

    expect(fixture.state.data.mantle.positionX).toBe(positionX);
    expect(fixture.state.data.mantle.previousX).toBe(previousX);
    expectMaximumConstraintStretch(fixture.state, 0.24);
  });

  it('检测传送后丢弃历史速度并恢复有限稳定形态', () => {
    const fixture = createFixture();
    for (let frame = 0; frame < 60; frame++) {
      fixture.animation.update(fixture.state, VANGUARD_MANTLE_FIXED_STEP);
      fixture.mantle.update(fixture.state, VANGUARD_MANTLE_FIXED_STEP);
    }
    fixture.state.data.transform.x[0] = 12;
    fixture.state.data.transform.z[0] = -9;
    fixture.animation.update(fixture.state, VANGUARD_MANTLE_FIXED_STEP);
    fixture.mantle.update(fixture.state, VANGUARD_MANTLE_FIXED_STEP);

    expect(fixture.state.data.mantle.elapsedTime[0]).toBe(0);
    expect(fixture.state.data.mantle.accumulator[0]).toBe(0);
    expect(fixture.state.data.mantle.rootX[0]).toBe(12);
    expect(fixture.state.data.mantle.rootZ[0]).toBe(-9);
    expect(Array.from(fixture.state.data.mantle.positionX).every(Number.isFinite)).toBe(true);
    expect(Array.from(fixture.state.data.mantle.positionY).every(Number.isFinite)).toBe(true);
    expect(Array.from(fixture.state.data.mantle.positionZ).every(Number.isFinite)).toBe(true);
  });

  it('把模拟中面恢复为有厚度的硬分面网格并保持单位法线', () => {
    const fixture = createFixture();
    const before = evaluateGeometry(fixture.state);
    for (let frame = 0; frame < 120; frame++) {
      fixture.animation.update(fixture.state, VANGUARD_MANTLE_FIXED_STEP);
      fixture.mantle.update(fixture.state, VANGUARD_MANTLE_FIXED_STEP);
    }
    const after = evaluateGeometry(fixture.state);
    const span = VANGUARD_MATTE_MESH_PLAN.semanticSpans[VanguardMatteSurface.Mantle];
    if (span === undefined) {
      throw new Error('披风测试缺少语义跨度。');
    }
    let changed = 0;
    const endVertex = span.startVertex + span.vertexCount;
    for (let vertex = span.startVertex; vertex < endVertex; vertex++) {
      const offset = vertex * 3;
      const travel = Math.hypot(
        (after.positions[offset] ?? 0) - (before.positions[offset] ?? 0),
        (after.positions[offset + 1] ?? 0) - (before.positions[offset + 1] ?? 0),
        (after.positions[offset + 2] ?? 0) - (before.positions[offset + 2] ?? 0),
      );
      if (travel > 0.0001) {
        changed++;
      }
      expect(Math.hypot(
        after.normals[offset] ?? 0,
        after.normals[offset + 1] ?? 0,
        after.normals[offset + 2] ?? 0,
      )).toBeCloseTo(1, 4);
    }
    expect(changed).toBeGreaterThan(span.vertexCount * 0.2);
  });
});

function createFixture(): Readonly<{
  state: VanguardState;
  animation: VanguardAnimationSystem;
  mantle: VanguardMantleSimulationSystem;
}> {
  const state = new VanguardState(TEST_OPTIONS);
  const animation = new VanguardAnimationSystem();
  const mantle = new VanguardMantleSimulationSystem();
  animation.initialize(state);
  mantle.initialize(state);
  return Object.freeze({ state, animation, mantle });
}

function evaluateGeometry(state: VanguardState): SurfaceBufferGeometry {
  const plan = VANGUARD_MATTE_MESH_PLAN;
  const geometry = createSurfaceGeometry(
    plan.vertexCount,
    plan.indexCount,
    GeometryIndexFormat.Uint16,
  );
  geometry.index.set(plan.indices);
  geometry.commitCounts(plan.vertexCount, plan.indexCount);
  new VanguardMeshEvaluator(plan, VANGUARD_MATTE_MESH_PALETTE).evaluate(
    state,
    plan,
    createVertexStreams(geometry),
    createEntityRange(0, state.count, state.count),
    MeshDirty.All,
  );
  return geometry;
}

function getMaximumParticleTravel(
  state: VanguardState,
  initialX: readonly number[],
  initialY: readonly number[],
  initialZ: readonly number[],
): number {
  let maximum = 0;
  for (let particle = 0; particle < VANGUARD_MANTLE_PARTICLE_COUNT; particle++) {
    if ((VANGUARD_MANTLE_PINNED[particle] ?? 0) !== 0) {
      continue;
    }
    maximum = Math.max(maximum, Math.hypot(
      (state.data.mantle.positionX[particle] ?? 0) - (initialX[particle] ?? 0),
      (state.data.mantle.positionY[particle] ?? 0) - (initialY[particle] ?? 0),
      (state.data.mantle.positionZ[particle] ?? 0) - (initialZ[particle] ?? 0),
    ));
  }
  return maximum;
}

function expectParticlesOutsideTorsoAndBackstop(state: VanguardState): void {
  const center = getChestOriginInRootSpace(state);
  for (let particle = 0; particle < VANGUARD_MANTLE_PARTICLE_COUNT; particle++) {
    if ((VANGUARD_MANTLE_PINNED[particle] ?? 0) !== 0) {
      continue;
    }
    const x = state.data.mantle.positionX[particle] ?? 0;
    const y = state.data.mantle.positionY[particle] ?? 0;
    const z = state.data.mantle.positionZ[particle] ?? 0;
    const ellipsoidDistance = (x - center.x) ** 2 / 0.62 ** 2
      + (y - center.y) ** 2 / 0.79 ** 2
      + (z - center.z) ** 2 / 0.37 ** 2;
    expect(z).toBeGreaterThanOrEqual((VANGUARD_MANTLE_BACKSTOP_Z[particle] ?? -1) - 0.00001);
    expect(ellipsoidDistance).toBeGreaterThanOrEqual(0.999);
  }
}

function getChestOriginInRootSpace(state: VanguardState): Readonly<{
  x: number;
  y: number;
  z: number;
}> {
  const matrixOffset = VanguardBone.Chest * VANGUARD_BONE_MATRIX_COMPONENTS;
  const matrices = state.data.pose.boneMatrices;
  const heading = state.data.transform.heading[0] ?? 0;
  const cosine = Math.cos(heading);
  const sine = Math.sin(heading);
  const inverseScale = 1 / (state.data.morphology.scale[0] ?? 1);
  const deltaX = (matrices[matrixOffset + 9] ?? 0) - (state.data.transform.x[0] ?? 0);
  const deltaZ = (matrices[matrixOffset + 11] ?? 0) - (state.data.transform.z[0] ?? 0);
  return Object.freeze({
    x: (deltaX * cosine - deltaZ * sine) * inverseScale,
    y: ((matrices[matrixOffset + 10] ?? 0) - (state.data.transform.y[0] ?? 0))
      * inverseScale,
    z: (deltaX * sine + deltaZ * cosine) * inverseScale,
  });
}

function expectMaximumConstraintStretch(state: VanguardState, maximumRatio: number): void {
  const constraints = VANGUARD_MANTLE_CONSTRAINTS;
  for (let constraint = 0; constraint < constraints.particleA.length; constraint++) {
    const a = constraints.particleA[constraint] ?? 0;
    const b = constraints.particleB[constraint] ?? 0;
    const length = Math.hypot(
      (state.data.mantle.positionX[b] ?? 0) - (state.data.mantle.positionX[a] ?? 0),
      (state.data.mantle.positionY[b] ?? 0) - (state.data.mantle.positionY[a] ?? 0),
      (state.data.mantle.positionZ[b] ?? 0) - (state.data.mantle.positionZ[a] ?? 0),
    );
    expect(Math.abs(length - (constraints.restLength[constraint] ?? length))
      / (constraints.restLength[constraint] ?? 1)).toBeLessThan(maximumRatio);
  }
}
