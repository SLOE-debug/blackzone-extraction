import { type FlatGridPlan } from './flat-grid-plan';

/** Flat Grid 共享采样缓存支持的数值精度。 */
export enum FlatGridWorkspacePrecision {
  Float32 = 'float32',
  Float64 = 'float64',
}

/** Flat Grid 可复用的连续三维位置流。 */
export type FlatGridPositionArray = Float32Array | Float64Array;

/** 与单个 FlatGridPlan 容量匹配的可复用采样工作区。 */
export interface FlatGridWorkspace {
  readonly sampleCount: number;
  readonly positions: FlatGridPositionArray;
}

/** 为指定 Plan 创建一次性分配、后续可反复覆盖的采样工作区。 */
export function createFlatGridWorkspace(
  plan: Readonly<FlatGridPlan>,
  precision: FlatGridWorkspacePrecision,
): FlatGridWorkspace {
  const length = plan.sampleCount * 3;
  let positions: FlatGridPositionArray;
  switch (precision) {
    case FlatGridWorkspacePrecision.Float32:
      positions = new Float32Array(length);
      break;
    case FlatGridWorkspacePrecision.Float64:
      positions = new Float64Array(length);
      break;
    default:
      throw new Error(`未知的 Flat Grid Workspace 精度：${String(precision)}`);
  }
  return Object.freeze({ sampleCount: plan.sampleCount, positions });
}

/** 验证 Workspace 与 Plan 的采样容量完全一致。 */
export function assertFlatGridWorkspace(
  plan: Readonly<FlatGridPlan>,
  workspace: Readonly<FlatGridWorkspace>,
): void {
  if (workspace.sampleCount !== plan.sampleCount
    || workspace.positions.length !== plan.sampleCount * 3) {
    throw new Error('Flat Grid Workspace 与 Plan 的采样容量不一致。');
  }
}
