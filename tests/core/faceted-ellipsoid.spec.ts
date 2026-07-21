import { describe, expect, it } from 'vitest';
import { evaluateFacetedEllipsoid } from '../../assets/core/geometry/faceted/faceted-ellipsoid-evaluator';
import {
  compileFacetedEllipsoidPlan,
  getFacetedEllipsoidTopologyMetrics,
} from '../../assets/core/geometry/faceted/faceted-ellipsoid-plan';
import { type VertexStreams } from '../../assets/core/mesh/vertex-streams';

const SPEC = Object.freeze({
  longitudeCount: 5,
  latitudeCount: 3,
  radialJitter: 0.12,
  ringTwist: 0.15,
  seed: 0x3157,
});

describe('可复用分面椭球', () => {
  it('使用无极点退化面的独立三角拓扑', () => {
    const metrics = getFacetedEllipsoidTopologyMetrics(
      SPEC.longitudeCount,
      SPEC.latitudeCount,
    );
    const plan = compileFacetedEllipsoidPlan(SPEC);

    expect(metrics).toEqual({ vertexCount: 60, indexCount: 60 });
    expect(plan.vertexCount).toBe(metrics.vertexCount);
    expect(Array.from(plan.indices)).toEqual(
      Array.from({ length: plan.indexCount }, (_, index) => index),
    );
  });

  it('确定性生成不规则轮廓并为每个三角形写入真实面法线', () => {
    const plan = compileFacetedEllipsoidPlan(SPEC);
    const samePlan = compileFacetedEllipsoidPlan(SPEC);
    const streams = createStreams(plan.vertexCount);

    expect(Array.from(samePlan.unitDirections)).toEqual(Array.from(plan.unitDirections));
    expect(Array.from(samePlan.radiusScales)).toEqual(Array.from(plan.radiusScales));
    expect(new Set(Array.from(plan.radiusScales)).size).toBeGreaterThan(2);

    evaluateFacetedEllipsoid(
      plan,
      streams,
      0,
      3,
      -2,
      1.5,
      2.4,
      1.7,
      1.1,
      0.37,
      true,
      true,
    );

    for (let vertex = 0; vertex < plan.vertexCount; vertex += 3) {
      const offset = vertex * 3;
      const areaTwice = getTriangleAreaTwice(streams.positions, offset);
      expect(areaTwice).toBeGreaterThan(0.000001);
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
