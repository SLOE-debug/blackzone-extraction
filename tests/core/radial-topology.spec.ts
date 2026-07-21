import { describe, expect, it } from 'vitest';
import {
  emitSampledRadialTopology,
  emitSampledRadialTopologyWithMeta,
  sampleRadialTopology,
} from '../../assets/core/geometry/radial/radial-emitter';
import { type RadialRingSource } from '../../assets/core/geometry/radial/radial-ring-source';
import {
  compileRadialTopologyPlan,
  RadialDegeneratePolicy,
  RadialSegmentOperationKind,
  RadialTopologyPassKind,
  RadialTriangleOrder,
  RadialWinding,
} from '../../assets/core/geometry/radial/radial-topology-plan';
import {
  createRadialWorkspace,
  type RadialPositionArray,
} from '../../assets/core/geometry/radial/radial-workspace';
import { StaticFacetedMeshSink } from '../../assets/core/geometry/faceted/static-faceted-mesh-sink';

const COLOR = Object.freeze({ red: 0.2, green: 0.4, blue: 0.6, alpha: 1 });
const ACCENT_COLOR = Object.freeze({ red: 0.9, green: 0.3, blue: 0.1, alpha: 1 });

describe('Core Radial Topology', () => {
  it('按 Side Bands、起点 Fan、终点 Fan 的顺序编译闭合壳体', () => {
    const plan = compileRadialTopologyPlan({
      ringCount: 2,
      segmentCount: 4,
      centerCount: 2,
      degeneratePolicy: RadialDegeneratePolicy.Reject,
      passes: [
        {
          kind: RadialTopologyPassKind.SideBands,
          firstRing: 0,
          lastRing: 1,
          winding: RadialWinding.Forward,
          triangleOrder: RadialTriangleOrder.PrimaryFirst,
        },
        {
          kind: RadialTopologyPassKind.Fan,
          ring: 0,
          center: 0,
          winding: RadialWinding.Forward,
        },
        {
          kind: RadialTopologyPassKind.Fan,
          ring: 1,
          center: 1,
          winding: RadialWinding.Reverse,
        },
      ],
    });

    expect(plan.triangleCount).toBe(16);
    expect(Array.from(plan.triangleSampleIndices)).toEqual([
      0, 4, 5, 0, 5, 1,
      1, 5, 6, 1, 6, 2,
      2, 6, 7, 2, 7, 3,
      3, 7, 4, 3, 4, 0,
      8, 0, 1, 8, 1, 2, 8, 2, 3, 8, 3, 0,
      9, 5, 4, 9, 6, 5, 9, 7, 6, 9, 4, 7,
    ]);
  });

  it('保留每个 Segment 内侧壁与多个 Fan 的交错顺序', () => {
    const plan = compileRadialTopologyPlan({
      ringCount: 2,
      segmentCount: 3,
      centerCount: 2,
      degeneratePolicy: RadialDegeneratePolicy.PreserveFixedTopology,
      passes: [{
        kind: RadialTopologyPassKind.SegmentSequence,
        operations: [
          {
            kind: RadialSegmentOperationKind.SideBand,
            firstRing: 0,
            secondRing: 1,
            winding: RadialWinding.Forward,
            triangleOrder: RadialTriangleOrder.PrimaryFirst,
          },
          {
            kind: RadialSegmentOperationKind.Fan,
            ring: 1,
            center: 0,
            winding: RadialWinding.Reverse,
          },
          {
            kind: RadialSegmentOperationKind.Fan,
            ring: 0,
            center: 1,
            winding: RadialWinding.Forward,
          },
        ],
      }],
    });

    expect(Array.from(plan.triangleSampleIndices.slice(0, 12))).toEqual([
      0, 3, 4,
      0, 4, 1,
      6, 4, 3,
      7, 0, 1,
    ]);
  });

  it('通过 Feature Ring Source 采样并生成单位硬分面法线', () => {
    const plan = compileRadialTopologyPlan({
      ringCount: 2,
      segmentCount: 4,
      centerCount: 0,
      degeneratePolicy: RadialDegeneratePolicy.Reject,
      passes: [{
        kind: RadialTopologyPassKind.SideBands,
        firstRing: 0,
        lastRing: 1,
        winding: RadialWinding.Forward,
        triangleOrder: RadialTriangleOrder.PrimaryFirst,
      }],
    });
    const workspace = createRadialWorkspace(plan);
    const context: TestRadialContext = { sampleCounter: { value: 0 } };
    sampleRadialTopology(plan, TEST_RING_SOURCE, context, workspace);
    const sink = new StaticFacetedMeshSink();
    emitSampledRadialTopology(plan, workspace, sink, COLOR);
    const geometry = sink.build();

    expect(context.sampleCounter.value).toBe(plan.sampleCount);
    expect(geometry.vertexCount).toBe(plan.triangleCount * 3);
    for (let offset = 0; offset < geometry.normals.length; offset += 3) {
      expect(Math.hypot(
        geometry.normals[offset] ?? 0,
        geometry.normals[offset + 1] ?? 0,
        geometry.normals[offset + 2] ?? 0,
      )).toBeCloseTo(1, 6);
    }
  });

  it('复用同一拓扑循环为相邻三角形解析不同面元数据', () => {
    const plan = compileRadialTopologyPlan({
      ringCount: 2,
      segmentCount: 3,
      centerCount: 0,
      degeneratePolicy: RadialDegeneratePolicy.Reject,
      passes: [{
        kind: RadialTopologyPassKind.SideBands,
        firstRing: 0,
        lastRing: 1,
        winding: RadialWinding.Forward,
        triangleOrder: RadialTriangleOrder.PrimaryFirst,
      }],
    });
    const workspace = createRadialWorkspace(plan);
    sampleRadialTopology(
      plan,
      TEST_RING_SOURCE,
      { sampleCounter: { value: 0 } },
      workspace,
    );
    const sink = new StaticFacetedMeshSink();
    emitSampledRadialTopologyWithMeta(
      plan,
      workspace,
      sink,
      (triangleIndex) => triangleIndex % 2 === 0 ? COLOR : ACCENT_COLOR,
    );
    const colors = sink.build().getColorView();

    expect(Array.from(colors.slice(0, 4))).toEqual(Array.from(Float32Array.of(
      0.2, 0.4, 0.6, 1,
    )));
    expect(Array.from(colors.slice(12, 16))).toEqual(Array.from(Float32Array.of(
      0.9, 0.3, 0.1, 1,
    )));
  });
});

interface TestRadialContext {
  readonly sampleCounter: { value: number };
}

const TEST_RING_SOURCE: RadialRingSource<TestRadialContext> = Object.freeze({
  sampleRing(context, ringIndex, segment, output, outputOffset): void {
    const angle = segment / 4 * Math.PI * 2;
    writePosition(output, outputOffset, Math.cos(angle), ringIndex, Math.sin(angle));
    context.sampleCounter.value += 1;
  },
  sampleCenter(): void {
    throw new Error('测试 Plan 不包含 Fan 中心。');
  },
});

function writePosition(
  output: RadialPositionArray,
  outputOffset: number,
  x: number,
  y: number,
  z: number,
): void {
  output[outputOffset] = x;
  output[outputOffset + 1] = y;
  output[outputOffset + 2] = z;
}
