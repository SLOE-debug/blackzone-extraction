import { type FixedTopologyMetrics } from '../../../core/geometry/fixed-topology';
import { VANGUARD_MATTE_CAGE, VANGUARD_METAL_CAGE } from './vanguard-model-cage';
import { VanguardMatteSurface, VanguardMetalSurface } from './vanguard-surface';

/** 一个连续顶点色区段在独立硬分面缓冲中的范围。 */
export interface VanguardSurfaceVertexRange {
  readonly startVertex: number;
  readonly vertexCount: number;
}

export const VANGUARD_MATTE_TRIANGLE_COUNT = VANGUARD_MATTE_CAGE.triangleCount;
export const VANGUARD_METAL_TRIANGLE_COUNT = VANGUARD_METAL_CAGE.triangleCount;
export const VANGUARD_TOTAL_TRIANGLE_COUNT = VANGUARD_MATTE_TRIANGLE_COUNT
  + VANGUARD_METAL_TRIANGLE_COUNT;

/** 主角皮肤、衣物、头发和皮具的固定拓扑。 */
export const VANGUARD_MATTE_TOPOLOGY = Object.freeze({
  verticesPerEntity: VANGUARD_MATTE_TRIANGLE_COUNT * 3,
  indicesPerEntity: VANGUARD_MATTE_TRIANGLE_COUNT * 3,
}) satisfies FixedTopologyMetrics;

/** 主角长剑和扣件的固定拓扑。 */
export const VANGUARD_METAL_TOPOLOGY = Object.freeze({
  verticesPerEntity: VANGUARD_METAL_TRIANGLE_COUNT * 3,
  indicesPerEntity: VANGUARD_METAL_TRIANGLE_COUNT * 3,
}) satisfies FixedTopologyMetrics;

const MATTE_SURFACE_RANGES = createSurfaceRanges(
  VANGUARD_MATTE_CAGE.surfaceTriangleCounts,
  VanguardMatteSurface.Count,
);
const METAL_SURFACE_RANGES = createSurfaceRanges(
  VANGUARD_METAL_CAGE.surfaceTriangleCounts,
  VanguardMetalSurface.Count,
);

/** 返回哑光层指定语义表面的连续顶点范围。 */
export function getVanguardMatteSurfaceRange(
  surface: VanguardMatteSurface,
): Readonly<VanguardSurfaceVertexRange> {
  if (surface === VanguardMatteSurface.Count) {
    throw new Error('主角哑光表面 Count 不能用于读取顶点范围。');
  }
  const range = MATTE_SURFACE_RANGES[surface];
  if (range === undefined) {
    throw new Error(`主角哑光表面范围不存在：${surface}`);
  }
  return range;
}

/** 返回金属层指定语义表面的连续顶点范围。 */
export function getVanguardMetalSurfaceRange(
  surface: VanguardMetalSurface,
): Readonly<VanguardSurfaceVertexRange> {
  if (surface === VanguardMetalSurface.Count) {
    throw new Error('主角金属表面 Count 不能用于读取顶点范围。');
  }
  const range = METAL_SURFACE_RANGES[surface];
  if (range === undefined) {
    throw new Error(`主角金属表面范围不存在：${surface}`);
  }
  return range;
}

/** 把每个表面的三角形数量转换为连续独立顶点范围。 */
function createSurfaceRanges(
  triangleCounts: readonly number[],
  surfaceCount: number,
): readonly VanguardSurfaceVertexRange[] {
  if (triangleCounts.length !== surfaceCount) {
    throw new Error('主角表面三角形数量与表面契约不一致。');
  }
  const ranges: VanguardSurfaceVertexRange[] = [];
  let startVertex = 0;
  for (const triangleCount of triangleCounts) {
    const vertexCount = triangleCount * 3;
    ranges.push(Object.freeze({ startVertex, vertexCount }));
    startVertex += vertexCount;
  }
  return Object.freeze(ranges);
}
