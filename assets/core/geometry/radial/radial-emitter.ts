import {
  emitFixedTopologyFlatTriangleCoordinates,
  emitFlatTriangleCoordinates,
  type FacetedTriangleSink,
} from '../faceted/faceted-emitter';
import { type RadialRingSource } from './radial-ring-source';
import {
  RadialDegeneratePolicy,
  type RadialTopologyPlan,
} from './radial-topology-plan';
import {
  assertRadialWorkspace,
  type RadialWorkspace,
} from './radial-workspace';

/** 按 Ring-major 顺序采样全部轮廓点和 Fan 中心。 */
export function sampleRadialTopology<TContext>(
  plan: Readonly<RadialTopologyPlan>,
  source: RadialRingSource<TContext>,
  context: Readonly<TContext>,
  workspace: Readonly<RadialWorkspace>,
): void {
  assertRadialWorkspace(plan, workspace);
  let sampleIndex = 0;
  for (let ring = 0; ring < plan.ringCount; ring++) {
    for (let segment = 0; segment < plan.segmentCount; segment++) {
      const outputOffset = sampleIndex * 3;
      source.sampleRing(context, ring, segment, workspace.positions, outputOffset);
      assertFiniteSample(workspace.positions, outputOffset);
      sampleIndex += 1;
    }
  }
  for (let center = 0; center < plan.centerCount; center++) {
    const outputOffset = sampleIndex * 3;
    source.sampleCenter(context, center, workspace.positions, outputOffset);
    assertFiniteSample(workspace.positions, outputOffset);
    sampleIndex += 1;
  }
  if (sampleIndex !== plan.sampleCount) {
    throw new Error('Radial Source 写入的采样数量与 Plan 不一致。');
  }
}

/** 按预编译 Pass 顺序把 Ring/Center 样本发射为独立硬分面三角形。 */
export function emitSampledRadialTopology<TMeta>(
  plan: Readonly<RadialTopologyPlan>,
  workspace: Readonly<RadialWorkspace>,
  sink: FacetedTriangleSink<TMeta>,
  meta: TMeta,
): void {
  assertRadialWorkspace(plan, workspace);
  const positions = workspace.positions;
  const samples = plan.triangleSampleIndices;
  const emitTriangle = plan.degeneratePolicy === RadialDegeneratePolicy.Reject
    ? emitFlatTriangleCoordinates
    : emitFixedTopologyFlatTriangleCoordinates;
  for (let offset = 0; offset < samples.length; offset += 3) {
    const aOffset = (samples[offset] ?? 0) * 3;
    const bOffset = (samples[offset + 1] ?? 0) * 3;
    const cOffset = (samples[offset + 2] ?? 0) * 3;
    emitTriangle(
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

/** 验证 Feature Ring Source 已完整覆盖当前三维采样槽。 */
function assertFiniteSample(positions: Float64Array, offset: number): void {
  const x = positions[offset];
  const y = positions[offset + 1];
  const z = positions[offset + 2];
  if (x === undefined || y === undefined || z === undefined
    || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    throw new Error('Radial Ring Source 必须输出有限三维坐标。');
  }
}
