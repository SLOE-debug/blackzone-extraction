import { type RadialTopologyPlan } from './radial-topology-plan';

/** Radial 领域采样保持 JavaScript number 精度的连续位置流。 */
export type RadialPositionArray = Float64Array;

/** 与单个 RadialTopologyPlan 容量匹配的可复用采样工作区。 */
export interface RadialWorkspace {
  readonly sampleCount: number;
  readonly positions: RadialPositionArray;
}

/** 创建可被同一 Plan 反复覆盖的双精度 Radial 工作区。 */
export function createRadialWorkspace(
  plan: Readonly<RadialTopologyPlan>,
): RadialWorkspace {
  return Object.freeze({
    sampleCount: plan.sampleCount,
    positions: new Float64Array(plan.sampleCount * 3),
  });
}

/** 验证 Workspace 与 Plan 的 Ring/Center 采样容量一致。 */
export function assertRadialWorkspace(
  plan: Readonly<RadialTopologyPlan>,
  workspace: Readonly<RadialWorkspace>,
): void {
  if (workspace.sampleCount !== plan.sampleCount
    || workspace.positions.length !== plan.sampleCount * 3) {
    throw new Error('Radial Workspace 与 Plan 的采样容量不一致。');
  }
}
