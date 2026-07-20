import {
  type FacetedTriangleSink,
  emitFixedTopologyFlatTriangleCoordinates,
} from '../faceted/faceted-emitter';
import { type FlatGridPlan } from './flat-grid-plan';
import {
  assertFlatGridWorkspace,
  type FlatGridPositionArray,
  type FlatGridWorkspace,
} from './flat-grid-workspace';

/** 把 Feature 领域上下文采样为连续三维位置的窄接口。 */
export interface GridPointSampler<TContext> {
  /** 原地写入当前列、行对应的三维位置，不得保留输出数组引用。 */
  sample(
    context: Readonly<TContext>,
    column: number,
    row: number,
    output: FlatGridPositionArray,
    outputOffset: number,
  ): void;
}

/** 按 Plan 的共享格点排布覆盖 Workspace，单个格点只采样一次。 */
export function sampleFlatGrid<TContext>(
  plan: Readonly<FlatGridPlan>,
  sampler: GridPointSampler<TContext>,
  context: Readonly<TContext>,
  workspace: Readonly<FlatGridWorkspace>,
): void {
  assertFlatGridWorkspace(plan, workspace);
  const sampleColumns = plan.columns + 1;
  for (let row = 0; row <= plan.rows; row++) {
    for (let column = 0; column <= plan.columns; column++) {
      const outputOffset = (row * sampleColumns + column) * 3;
      sampler.sample(context, column, row, workspace.positions, outputOffset);
      const x = workspace.positions[outputOffset];
      const y = workspace.positions[outputOffset + 1];
      const z = workspace.positions[outputOffset + 2];
      if (x === undefined || y === undefined || z === undefined
        || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        throw new Error('Flat Grid Sampler 必须输出有限三维坐标。');
      }
    }
  }
}

/** 按预编译样本索引把共享格点展开为独立硬分面三角形。 */
export function emitSampledFlatGrid<TMeta>(
  plan: Readonly<FlatGridPlan>,
  workspace: Readonly<FlatGridWorkspace>,
  sink: FacetedTriangleSink<TMeta>,
  meta: TMeta,
): void {
  assertFlatGridWorkspace(plan, workspace);
  const positions = workspace.positions;
  const samples = plan.triangleSampleIndices;
  for (let offset = 0; offset < samples.length; offset += 3) {
    const aOffset = (samples[offset] ?? 0) * 3;
    const bOffset = (samples[offset + 1] ?? 0) * 3;
    const cOffset = (samples[offset + 2] ?? 0) * 3;
    emitFixedTopologyFlatTriangleCoordinates(
      sink,
      meta,
      positions[aOffset] ?? 0,
      positions[aOffset + 1] ?? 0,
      positions[aOffset + 2] ?? 0,
      positions[bOffset] ?? 0,
      positions[bOffset + 1] ?? 0,
      positions[bOffset + 2] ?? 0,
      positions[cOffset] ?? 0,
      positions[cOffset + 1] ?? 0,
      positions[cOffset + 2] ?? 0,
    );
  }
}
