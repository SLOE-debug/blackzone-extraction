import { describe, expect, it } from 'vitest';
import {
  createStaticSurfaceGeometry,
  GeometryIndexFormat,
} from '../../assets/core/geometry/buffer-geometry';
import {
  emitSampledFlatGrid,
  type GridPointSampler,
  sampleFlatGrid,
} from '../../assets/core/geometry/grid/flat-grid-emitter';
import {
  compileFlatGridPlan,
  FlatGridDiagonalKind,
  FlatGridTriangleOrder,
  FlatGridWinding,
  getFlatGridTopologyMetrics,
  PRIMARY_FIRST_FLAT_GRID_TRIANGLE_ORDER,
} from '../../assets/core/geometry/grid/flat-grid-plan';
import {
  createFlatGridWorkspace,
  type FlatGridPositionArray,
  FlatGridWorkspacePrecision,
} from '../../assets/core/geometry/grid/flat-grid-workspace';
import {
  defineSurfaceFrame,
  type SurfaceFrame,
} from '../../assets/core/geometry/grid/surface-frame';
import { TriangleMeshWriter } from '../../assets/core/geometry/triangle-mesh-writer';

describe('Core Flat Grid', () => {
  it('采样一次共享格点并按预编译绕序展开硬分面', () => {
    const plan = compileFlatGridPlan({
      columns: 1,
      rows: 1,
      diagonal: Object.freeze({ kind: FlatGridDiagonalKind.FixedForward }),
      winding: FlatGridWinding.Reverse,
      triangleOrder: PRIMARY_FIRST_FLAT_GRID_TRIANGLE_ORDER,
    });
    const workspace = createFlatGridWorkspace(plan, FlatGridWorkspacePrecision.Float64);
    const context: SurfaceSampleContext = {
      frame: defineSurfaceFrame({
        originX: 1, originY: 2, originZ: 3,
        ux: 1, uy: 0, uz: 0,
        vx: 0, vy: 0, vz: 1,
        nx: 0, ny: 1, nz: 0,
      }),
      width: 2,
      height: 4,
      sampleCounter: { value: 0 },
    };
    sampleFlatGrid(plan, TEST_SURFACE_SAMPLER, context, workspace);

    const metrics = getFlatGridTopologyMetrics(plan);
    const geometry = createStaticSurfaceGeometry(
      metrics.verticesPerEntity,
      metrics.indicesPerEntity,
      GeometryIndexFormat.Uint16,
    );
    const writer = new TriangleMeshWriter(geometry);
    writer.reset(true);
    emitSampledFlatGrid(plan, workspace, writer, undefined);
    writer.commit();

    expect(context.sampleCounter.value).toBe(plan.sampleCount);
    expect(geometry.vertexCount).toBe(6);
    expect(Array.from(geometry.getPositionView())).toEqual([
      1, 3, 3,
      3, 3, 7,
      3, 3, 3,
      1, 3, 3,
      1, 3, 7,
      3, 3, 7,
    ]);
    for (let offset = 0; offset < geometry.vertexCount * 3; offset += 3) {
      expect(geometry.normals[offset]).toBeCloseTo(0);
      expect(geometry.normals[offset + 1]).toBeCloseTo(1);
      expect(geometry.normals[offset + 2]).toBeCloseTo(0);
    }
  });

  it('分别锁定两种对角线的三角形顺序', () => {
    const plan = compileFlatGridPlan({
      columns: 2,
      rows: 1,
      diagonal: Object.freeze({
        kind: FlatGridDiagonalKind.Alternating,
        parityOffset: 0,
      }),
      winding: FlatGridWinding.Forward,
      triangleOrder: Object.freeze({
        forward: FlatGridTriangleOrder.SecondaryFirst,
        backward: FlatGridTriangleOrder.PrimaryFirst,
      }),
    });

    expect(Array.from(plan.triangleSampleIndices)).toEqual([
      0, 4, 3,
      0, 1, 4,
      1, 2, 4,
      2, 5, 4,
    ]);
  });

  it('拒绝与 Plan 容量不匹配的 Workspace', () => {
    const smallPlan = compileFlatGridPlan({
      columns: 1,
      rows: 1,
      diagonal: Object.freeze({ kind: FlatGridDiagonalKind.FixedForward }),
      winding: FlatGridWinding.Forward,
      triangleOrder: PRIMARY_FIRST_FLAT_GRID_TRIANGLE_ORDER,
    });
    const largerPlan = compileFlatGridPlan({
      columns: 2,
      rows: 1,
      diagonal: Object.freeze({ kind: FlatGridDiagonalKind.FixedBackward }),
      winding: FlatGridWinding.Forward,
      triangleOrder: PRIMARY_FIRST_FLAT_GRID_TRIANGLE_ORDER,
    });
    const workspace = createFlatGridWorkspace(
      smallPlan,
      FlatGridWorkspacePrecision.Float32,
    );

    expect(workspace.positions).toBeInstanceOf(Float32Array);
    expect(() => sampleFlatGrid(
      largerPlan,
      TEST_SURFACE_SAMPLER,
      createDefaultContext(),
      workspace,
    )).toThrow(/容量不一致/);
  });
});

interface SurfaceSampleContext {
  readonly frame: Readonly<SurfaceFrame>;
  readonly width: number;
  readonly height: number;
  readonly sampleCounter: { value: number };
}

const TEST_SURFACE_SAMPLER: GridPointSampler<SurfaceSampleContext> = Object.freeze({
  sample(
    context: Readonly<SurfaceSampleContext>,
    column: number,
    row: number,
    output: FlatGridPositionArray,
    outputOffset: number,
  ): void {
    const u = context.width * column;
    const v = context.height * row;
    const n = 1;
    const frame = context.frame;
    output[outputOffset] = frame.originX + frame.ux * u + frame.vx * v + frame.nx * n;
    output[outputOffset + 1] = frame.originY + frame.uy * u + frame.vy * v + frame.ny * n;
    output[outputOffset + 2] = frame.originZ + frame.uz * u + frame.vz * v + frame.nz * n;
    context.sampleCounter.value += 1;
  },
});

function createDefaultContext(): SurfaceSampleContext {
  return {
    frame: defineSurfaceFrame({
      originX: 0, originY: 0, originZ: 0,
      ux: 1, uy: 0, uz: 0,
      vx: 0, vy: 0, vz: 1,
      nx: 0, ny: 1, nz: 0,
    }),
    width: 1,
    height: 1,
    sampleCounter: { value: 0 },
  };
}
