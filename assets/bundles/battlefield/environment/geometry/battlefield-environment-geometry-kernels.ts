import {
  emitDoubleSidedFlatQuad,
  emitOrientedFlatQuad,
  emitOrientedFlatTriangle,
} from '../../../../core/geometry/faceted/faceted-emitter';
import { type FacetedPoint } from '../../../../core/geometry/faceted/facet-orientation';
import {
  emitSampledRadialTopology,
  sampleRadialTopology,
} from '../../../../core/geometry/radial/radial-emitter';
import { type RadialRingSource } from '../../../../core/geometry/radial/radial-ring-source';
import {
  compileRadialTopologyPlan,
  RadialDegeneratePolicy,
  RadialTopologyPassKind,
  RadialTriangleOrder,
  RadialWinding,
} from '../../../../core/geometry/radial/radial-topology-plan';
import {
  createRadialWorkspace,
  type RadialPositionArray,
} from '../../../../core/geometry/radial/radial-workspace';
import {
  type BattlefieldEnvironmentColor,
  BattlefieldEnvironmentMeshSink,
} from './battlefield-environment-mesh-sink';

const TAU = Math.PI * 2;

/** 一个可沿任意固定截面基向量生成的管体环。 */
export interface BattlefieldEnvironmentTubeRing {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radiusU: number;
  readonly radiusV: number;
  readonly rotation: number;
}

/** 管体截面所在平面的两个正交方向。 */
export interface BattlefieldEnvironmentTubeBasis {
  readonly ux: number;
  readonly uy: number;
  readonly uz: number;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
}

/** Y-up 树干、晶体和菌柄使用的水平截面基。 */
export const HORIZONTAL_TUBE_BASIS: BattlefieldEnvironmentTubeBasis = Object.freeze({
  ux: 1,
  uy: 0,
  uz: 0,
  vx: 0,
  vy: 0,
  vz: 1,
});

/** 车轮等沿世界 Z 延伸的竖直截面基。 */
export const Z_AXIS_TUBE_BASIS: BattlefieldEnvironmentTubeBasis = Object.freeze({
  ux: 0,
  uy: 1,
  uz: 0,
  vx: 1,
  vy: 0,
  vz: 0,
});

/** 生成低段数、非均匀半径且带端盖的确定性管体。 */
export function appendIrregularTube(
  sink: BattlefieldEnvironmentMeshSink,
  color: Readonly<BattlefieldEnvironmentColor>,
  rings: readonly BattlefieldEnvironmentTubeRing[],
  segments: number,
  variationSeed: number,
  basis: Readonly<BattlefieldEnvironmentTubeBasis> = HORIZONTAL_TUBE_BASIS,
): void {
  if (rings.length < 2 || !Number.isInteger(segments) || segments < 3) {
    throw new Error('环境管体至少需要两个环和三个截面分段。');
  }
  const plan = compileRadialTopologyPlan({
    ringCount: rings.length,
    segmentCount: segments,
    centerCount: 2,
    degeneratePolicy: RadialDegeneratePolicy.Reject,
    passes: Object.freeze([
      Object.freeze({
        kind: RadialTopologyPassKind.SideBands,
        firstRing: 0,
        lastRing: rings.length - 1,
        winding: RadialWinding.Forward,
        triangleOrder: RadialTriangleOrder.PrimaryFirst,
      }),
      Object.freeze({
        kind: RadialTopologyPassKind.Fan,
        ring: 0,
        center: 0,
        winding: RadialWinding.Forward,
      }),
      Object.freeze({
        kind: RadialTopologyPassKind.Fan,
        ring: rings.length - 1,
        center: 1,
        winding: RadialWinding.Reverse,
      }),
    ]),
  });
  const workspace = createRadialWorkspace(plan);
  const context: EnvironmentTubeSampleContext = {
    rings,
    segments,
    variationSeed,
    basis,
  };
  sampleRadialTopology(plan, ENVIRONMENT_TUBE_SOURCE, context, workspace);
  emitSampledRadialTopology(plan, workspace, sink, color);
}

/** 写入四点底面与四点顶面构成的领域化偏斜箱体。 */
export function appendSkewedPrism(
  sink: BattlefieldEnvironmentMeshSink,
  color: Readonly<BattlefieldEnvironmentColor>,
  bottom: readonly FacetedPoint[],
  top: readonly FacetedPoint[],
): void {
  if (bottom.length !== top.length || bottom.length < 3) {
    throw new Error('偏斜棱柱的上下轮廓必须拥有相同且不少于三个顶点。');
  }
  const center = averagePoints([...bottom, ...top]);
  for (let index = 0; index < bottom.length; index++) {
    const next = (index + 1) % bottom.length;
    const a = bottom[index];
    const b = top[index];
    const c = top[next];
    const d = bottom[next];
    if (a === undefined || b === undefined || c === undefined || d === undefined) {
      throw new Error('偏斜棱柱轮廓点不存在。');
    }
    const outwardX = (a.x + b.x + c.x + d.x) * 0.25 - center.x;
    const outwardY = (a.y + b.y + c.y + d.y) * 0.25 - center.y;
    const outwardZ = (a.z + b.z + c.z + d.z) * 0.25 - center.z;
    emitOrientedFlatQuad(sink, color, a, b, c, d, outwardX, outwardY, outwardZ);
  }
  appendPolygonCap(sink, color, bottom, 0, -1, 0);
  appendPolygonCap(sink, color, top, 0, 1, 0);
}

/** 写入具有厚度感的双面叶片或破损金属板。 */
export function appendFacetedBlade(
  sink: BattlefieldEnvironmentMeshSink,
  color: Readonly<BattlefieldEnvironmentColor>,
  rootLeft: Readonly<FacetedPoint>,
  rootRight: Readonly<FacetedPoint>,
  shoulder: Readonly<FacetedPoint>,
  tip: Readonly<FacetedPoint>,
): void {
  emitDoubleSidedFlatQuad(sink, color, rootLeft, rootRight, shoulder, tip);
}

interface EnvironmentTubeSampleContext {
  readonly rings: readonly BattlefieldEnvironmentTubeRing[];
  readonly segments: number;
  readonly variationSeed: number;
  readonly basis: Readonly<BattlefieldEnvironmentTubeBasis>;
}

/** 环境领域负责的半径扰动、截面基和弯曲中心采样。 */
const ENVIRONMENT_TUBE_SOURCE: RadialRingSource<EnvironmentTubeSampleContext> = Object.freeze({
  sampleRing(context, ringIndex, segment, output, outputOffset): void {
    const ring = context.rings[ringIndex];
    if (ring === undefined) {
      throw new Error('环境管体环数据不完整。');
    }
    const angle = ring.rotation + segment / context.segments * TAU;
    const seed = context.variationSeed + ringIndex * 17;
    const variation = 1 + Math.sin((segment + 1) * 2.173 + seed * 0.731) * 0.09;
    const u = Math.cos(angle) * ring.radiusU * variation;
    const v = Math.sin(angle) * ring.radiusV * (2 - variation);
    writeRadialPosition(
      output,
      outputOffset,
      ring.x + context.basis.ux * u + context.basis.vx * v,
      ring.y + context.basis.uy * u + context.basis.vy * v,
      ring.z + context.basis.uz * u + context.basis.vz * v,
    );
  },
  sampleCenter(context, centerIndex, output, outputOffset): void {
    const ringIndex = centerIndex === 0 ? 0 : context.rings.length - 1;
    const ring = context.rings[ringIndex];
    if (ring === undefined) {
      throw new Error('环境管体端盖中心不存在。');
    }
    writeRadialPosition(output, outputOffset, ring.x, ring.y, ring.z);
  },
});

/** 原地写入环境管体的双精度 Radial 采样点。 */
function writeRadialPosition(
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

function appendPolygonCap(
  sink: BattlefieldEnvironmentMeshSink,
  color: Readonly<BattlefieldEnvironmentColor>,
  points: readonly FacetedPoint[],
  outwardX: number,
  outwardY: number,
  outwardZ: number,
): void {
  const center = averagePoints(points);
  for (let index = 0; index < points.length; index++) {
    const next = (index + 1) % points.length;
    const a = points[index];
    const b = points[next];
    if (a === undefined || b === undefined) {
      throw new Error('多边形端盖顶点不存在。');
    }
    emitOrientedFlatTriangle(sink, color, center, a, b, outwardX, outwardY, outwardZ);
  }
}

function averagePoints(points: readonly FacetedPoint[]): FacetedPoint {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
    z += point.z;
  }
  const inverseCount = 1 / Math.max(points.length, 1);
  return Object.freeze({ x: x * inverseCount, y: y * inverseCount, z: z * inverseCount });
}
