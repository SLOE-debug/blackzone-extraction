import { describe, expect, it } from 'vitest';
import {
  createFacetedCubicTubeWorkspace,
  evaluateFacetedCubicTube,
} from '../../assets/core/geometry/faceted/faceted-cubic-tube-evaluator';
import {
  compileFacetedCubicTubePlan,
  getFacetedCubicTubeTopologyMetrics,
} from '../../assets/core/geometry/faceted/faceted-cubic-tube-plan';
import { type VertexStreams } from '../../assets/core/mesh/vertex-streams';

const SPEC = Object.freeze({
  segmentCount: 6,
  radialCount: 4,
  radialJitter: 0.11,
  ringTwist: 0.14,
  seed: 0x781d,
});

describe('可复用分面贝塞尔管体', () => {
  it('把共享截面展开为顺序独立三角形', () => {
    const metrics = getFacetedCubicTubeTopologyMetrics(
      SPEC.segmentCount,
      SPEC.radialCount,
    );
    const plan = compileFacetedCubicTubePlan(SPEC);

    expect(metrics).toEqual({ vertexCount: 144, indexCount: 144 });
    expect(plan.logicalVertexCount).toBe(28);
    expect(Array.from(plan.indices)).toEqual(
      Array.from({ length: plan.indexCount }, (_, index) => index),
    );
  });

  it('复用工作区求值不规则曲面并写入单位面法线', () => {
    const plan = compileFacetedCubicTubePlan(SPEC);
    const streams = createStreams(plan.vertexCount);
    const workspace = createFacetedCubicTubeWorkspace(plan);
    evaluateFacetedCubicTube(
      plan,
      streams,
      0,
      {
        p0x: 0,
        p0y: 0,
        p0z: 0,
        p1x: 0.8,
        p1y: 0.2,
        p1z: 0.7,
        p2x: 1.6,
        p2y: 1.2,
        p2z: 0.3,
        p3x: 2.4,
        p3y: 1.5,
        p3z: 0.1,
        startRadius: 0.36,
        endRadius: 0.18,
      },
      workspace,
      true,
      true,
    );

    expect(new Set(Array.from(plan.radiusScales)).size).toBeGreaterThan(2);
    for (let vertex = 0; vertex < plan.vertexCount; vertex += 3) {
      const offset = vertex * 3;
      expect(getTriangleAreaTwice(streams.positions, offset)).toBeGreaterThan(0.000001);
      const normal = Array.from(streams.normals.slice(offset, offset + 3));
      expect(Array.from(streams.normals.slice(offset + 3, offset + 6))).toEqual(normal);
      expect(Array.from(streams.normals.slice(offset + 6, offset + 9))).toEqual(normal);
      expect(Math.hypot(normal[0] ?? 0, normal[1] ?? 0, normal[2] ?? 0)).toBeCloseTo(1, 6);
    }
  });
});

function createStreams(vertexCount: number): VertexStreams {
  return {
    positions: new Float32Array(vertexCount * 3),
    normals: new Float32Array(vertexCount * 3),
    colors: new Float32Array(vertexCount * 4),
  };
}

function getTriangleAreaTwice(positions: Float32Array, offset: number): number {
  const ax = positions[offset] ?? 0;
  const ay = positions[offset + 1] ?? 0;
  const az = positions[offset + 2] ?? 0;
  const abx = (positions[offset + 3] ?? 0) - ax;
  const aby = (positions[offset + 4] ?? 0) - ay;
  const abz = (positions[offset + 5] ?? 0) - az;
  const acx = (positions[offset + 6] ?? 0) - ax;
  const acy = (positions[offset + 7] ?? 0) - ay;
  const acz = (positions[offset + 8] ?? 0) - az;
  return Math.hypot(
    aby * acz - abz * acy,
    abz * acx - abx * acz,
    abx * acy - aby * acx,
  );
}
