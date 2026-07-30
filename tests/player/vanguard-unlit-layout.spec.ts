import { describe, expect, it } from 'vitest';
import { createEntityRange } from '../../assets/core/entities/entity-range';
import {
  createUnlitColorGeometry,
  GeometryIndexFormat,
} from '../../assets/core/geometry/buffer-geometry';
import { MeshDirty } from '../../assets/core/mesh/mesh-dirty';
import { createVertexStreams } from '../../assets/core/mesh/vertex-streams';
import { UNLIT_COLOR_LAYOUT, VertexSemantic } from '../../assets/core/mesh/vertex-layout';
import { VanguardAnimationSystem } from '../../assets/player/vanguard/animation/vanguard-animation-system';
import { VanguardMeshEvaluator } from '../../assets/player/vanguard/geometry/vanguard-mesh-evaluator';
import { VANGUARD_MATTE_MESH_PLAN } from '../../assets/player/vanguard/geometry/vanguard-mesh-plans';
import { VanguardAction } from '../../assets/player/vanguard/model/vanguard-action';
import { VanguardState } from '../../assets/player/vanguard/model/vanguard-state';
import { VANGUARD_MATTE_MESH_PALETTE } from '../../assets/player/vanguard/rendering/vanguard-mesh-palette';

describe('主角 Unlit 精确顶点布局', () => {
  it('只求值位置和颜色，并拒绝无效法线请求', () => {
    const state = new VanguardState(Object.freeze({
      position: Object.freeze({ x: 0, y: 0.05, z: 0 }),
      heading: 0,
      action: VanguardAction.Idle,
    }));
    new VanguardAnimationSystem().initialize(state);
    const plan = VANGUARD_MATTE_MESH_PLAN;
    const geometry = createUnlitColorGeometry(
      plan.vertexCount,
      plan.indexCount,
      GeometryIndexFormat.Uint16,
    );
    geometry.index.set(plan.indices);
    geometry.commitCounts(plan.vertexCount, plan.indexCount);
    const streams = createVertexStreams(geometry);
    const evaluator = new VanguardMeshEvaluator(
      plan,
      VANGUARD_MATTE_MESH_PALETTE,
      UNLIT_COLOR_LAYOUT,
    );
    const range = createEntityRange(0, state.count, state.count);

    expect(geometry.layout.semantics).toEqual([
      VertexSemantic.Position,
      VertexSemantic.Color,
    ]);
    expect(evaluator.evaluate(
      state,
      plan,
      streams,
      range,
      MeshDirty.Position | MeshDirty.Color | MeshDirty.Bounds,
    )).toBe(MeshDirty.Position | MeshDirty.Color | MeshDirty.Bounds);
    expect(() => evaluator.evaluate(
      state,
      plan,
      streams,
      range,
      MeshDirty.Normal,
    )).toThrow('不接受法线');
  });
});
