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
import { VANGUARD_MATTE_MESH_PLAN } from '../../assets/player/vanguard/geometry/vanguard-mesh-plans';
import { VanguardMatteSurface } from '../../assets/player/vanguard/geometry/vanguard-surface';
import { VanguardAction } from '../../assets/player/vanguard/model/vanguard-action';
import {
  resolveVanguardDepth,
  resolveVanguardDepthRadius,
} from '../../assets/player/vanguard/model/vanguard-depth-profile';
import { VanguardState } from '../../assets/player/vanguard/model/vanguard-state';
import { VANGUARD_MATTE_MESH_PALETTE } from '../../assets/player/vanguard/rendering/vanguard-mesh-palette';

const BASE_Y = 0.72;

describe('主角侧面体积轮廓', () => {
  it('按高度连续塑造胸背、头部和腿脚的非均匀纵深', () => {
    const chestFront = resolveVanguardDepth(2.7, 0.25);
    const chestBack = -resolveVanguardDepth(2.7, -0.25);
    const headFront = resolveVanguardDepth(3.5, 0.25);
    const bootFront = resolveVanguardDepth(0.1, 0.25);

    expect(chestFront).toBeGreaterThan(headFront);
    expect(headFront).toBeGreaterThan(bootFront);
    expect(chestBack).toBeGreaterThan(chestFront);
    expect(resolveVanguardDepthRadius(2.7, 0.25)).toBeCloseTo(chestBack, 6);
  });

  it('最终硬分面网格在胸腔、头部和小腿处保持可读侧面厚度', () => {
    const geometry = evaluateVanguard();
    const torsoDepth = getSurfaceDepthAtHeight(
      geometry,
      VanguardMatteSurface.Tunic,
      BASE_Y + 2.68,
      0.08,
      0.62,
    );
    const headDepth = getSurfaceDepthAtHeight(
      geometry,
      VanguardMatteSurface.Skin,
      BASE_Y + 3.5,
      0.1,
      0.34,
    );
    const lowerLegDepth = getSurfaceDepthAtHeight(
      geometry,
      VanguardMatteSurface.Leather,
      BASE_Y + 0.56,
      0.08,
      0.55,
    );

    expect(torsoDepth).toBeGreaterThan(0.65);
    expect(torsoDepth).toBeLessThan(0.82);
    expect(headDepth).toBeGreaterThan(0.58);
    expect(lowerLegDepth).toBeGreaterThan(0.32);
  });
});

function evaluateVanguard(): SurfaceBufferGeometry {
  const state = new VanguardState(Object.freeze({
    position: Object.freeze({ x: 0, y: BASE_Y, z: -2 }),
    heading: 0,
    action: VanguardAction.Idle,
  }));
  new VanguardAnimationSystem().initialize(state);
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

function getSurfaceDepthAtHeight(
  geometry: SurfaceBufferGeometry,
  surface: VanguardMatteSurface,
  centerY: number,
  halfRange: number,
  maximumAbsoluteX: number,
): number {
  const span = VANGUARD_MATTE_MESH_PLAN.semanticSpans[surface];
  if (span === undefined) {
    throw new Error(`主角侧面测试缺少表面区段：${surface}`);
  }
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  const end = span.startVertex + span.vertexCount;
  for (let vertex = span.startVertex; vertex < end; vertex++) {
    const offset = vertex * 3;
    const x = geometry.positions[offset] ?? 0;
    const y = geometry.positions[offset + 1] ?? 0;
    if (Math.abs(x) > maximumAbsoluteX || Math.abs(y - centerY) > halfRange) {
      continue;
    }
    const z = geometry.positions[offset + 2] ?? 0;
    minimum = Math.min(minimum, z);
    maximum = Math.max(maximum, z);
  }
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
    throw new Error(`主角侧面测试未找到高度 ${centerY} 的表面顶点。`);
  }
  return maximum - minimum;
}
