import {
  type BattlefieldEnvironmentColor,
  BattlefieldEnvironmentMeshBuilder,
  type BattlefieldEnvironmentPoint,
} from './battlefield-environment-mesh-builder';

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
  builder: BattlefieldEnvironmentMeshBuilder,
  color: Readonly<BattlefieldEnvironmentColor>,
  rings: readonly BattlefieldEnvironmentTubeRing[],
  segments: number,
  variationSeed: number,
  basis: Readonly<BattlefieldEnvironmentTubeBasis> = HORIZONTAL_TUBE_BASIS,
  doubleSided = false,
): void {
  if (rings.length < 2 || !Number.isInteger(segments) || segments < 3) {
    throw new Error('环境管体至少需要两个环和三个截面分段。');
  }
  const ringPoints = rings.map((ring, ringIndex) => createRingPoints(
    ring,
    segments,
    variationSeed + ringIndex * 17,
    basis,
  ));
  for (let ringIndex = 0; ringIndex < ringPoints.length - 1; ringIndex++) {
    const lower = ringPoints[ringIndex];
    const upper = ringPoints[ringIndex + 1];
    const lowerSpec = rings[ringIndex];
    const upperSpec = rings[ringIndex + 1];
    if (lower === undefined || upper === undefined
      || lowerSpec === undefined || upperSpec === undefined) {
      throw new Error('环境管体环数据不完整。');
    }
    for (let segment = 0; segment < segments; segment++) {
      const next = (segment + 1) % segments;
      const a = lower[segment];
      const b = upper[segment];
      const c = upper[next];
      const d = lower[next];
      if (a === undefined || b === undefined || c === undefined || d === undefined) {
        throw new Error('环境管体截面点不存在。');
      }
      const outwardX = (a.x + b.x + c.x + d.x) * 0.25
        - (lowerSpec.x + upperSpec.x) * 0.5;
      const outwardY = (a.y + b.y + c.y + d.y) * 0.25
        - (lowerSpec.y + upperSpec.y) * 0.5;
      const outwardZ = (a.z + b.z + c.z + d.z) * 0.25
        - (lowerSpec.z + upperSpec.z) * 0.5;
      if (doubleSided) {
        builder.doubleSidedQuad(color, a, b, c, d);
      } else {
        builder.orientedQuad(color, a, b, c, d, outwardX, outwardY, outwardZ);
      }
    }
  }
  appendTubeCap(builder, color, ringPoints[0], rings[0], rings[1], doubleSided);
  appendTubeCap(
    builder,
    color,
    ringPoints[ringPoints.length - 1],
    rings[rings.length - 1],
    rings[rings.length - 2],
    doubleSided,
  );
}

/** 写入四点底面与四点顶面构成的领域化偏斜箱体。 */
export function appendSkewedPrism(
  builder: BattlefieldEnvironmentMeshBuilder,
  color: Readonly<BattlefieldEnvironmentColor>,
  bottom: readonly BattlefieldEnvironmentPoint[],
  top: readonly BattlefieldEnvironmentPoint[],
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
    builder.orientedQuad(color, a, b, c, d, outwardX, outwardY, outwardZ);
  }
  appendPolygonCap(builder, color, bottom, 0, -1, 0);
  appendPolygonCap(builder, color, top, 0, 1, 0);
}

/** 写入具有厚度感的双面叶片或破损金属板。 */
export function appendFacetedBlade(
  builder: BattlefieldEnvironmentMeshBuilder,
  color: Readonly<BattlefieldEnvironmentColor>,
  rootLeft: Readonly<BattlefieldEnvironmentPoint>,
  rootRight: Readonly<BattlefieldEnvironmentPoint>,
  shoulder: Readonly<BattlefieldEnvironmentPoint>,
  tip: Readonly<BattlefieldEnvironmentPoint>,
): void {
  builder.doubleSidedQuad(color, rootLeft, rootRight, shoulder, tip);
}

function createRingPoints(
  ring: Readonly<BattlefieldEnvironmentTubeRing>,
  segments: number,
  seed: number,
  basis: Readonly<BattlefieldEnvironmentTubeBasis>,
): readonly BattlefieldEnvironmentPoint[] {
  const points: BattlefieldEnvironmentPoint[] = [];
  for (let segment = 0; segment < segments; segment++) {
    const angle = ring.rotation + segment / segments * TAU;
    const variation = 1 + Math.sin((segment + 1) * 2.173 + seed * 0.731) * 0.09;
    const u = Math.cos(angle) * ring.radiusU * variation;
    const v = Math.sin(angle) * ring.radiusV * (2 - variation);
    points.push(Object.freeze({
      x: ring.x + basis.ux * u + basis.vx * v,
      y: ring.y + basis.uy * u + basis.vy * v,
      z: ring.z + basis.uz * u + basis.vz * v,
    }));
  }
  return Object.freeze(points);
}

function appendTubeCap(
  builder: BattlefieldEnvironmentMeshBuilder,
  color: Readonly<BattlefieldEnvironmentColor>,
  points: readonly BattlefieldEnvironmentPoint[] | undefined,
  ring: Readonly<BattlefieldEnvironmentTubeRing> | undefined,
  neighbor: Readonly<BattlefieldEnvironmentTubeRing> | undefined,
  doubleSided: boolean,
): void {
  if (points === undefined || ring === undefined || neighbor === undefined) {
    throw new Error('环境管体端盖数据不完整。');
  }
  const center = Object.freeze({ x: ring.x, y: ring.y, z: ring.z });
  const outwardX = ring.x - neighbor.x;
  const outwardY = ring.y - neighbor.y;
  const outwardZ = ring.z - neighbor.z;
  for (let segment = 0; segment < points.length; segment++) {
    const next = (segment + 1) % points.length;
    const a = points[segment];
    const b = points[next];
    if (a === undefined || b === undefined) {
      throw new Error('环境管体端盖顶点不存在。');
    }
    builder.orientedTriangle(color, center, a, b, outwardX, outwardY, outwardZ);
    if (doubleSided) {
      builder.orientedTriangle(color, center, b, a, -outwardX, -outwardY, -outwardZ);
    }
  }
}

function appendPolygonCap(
  builder: BattlefieldEnvironmentMeshBuilder,
  color: Readonly<BattlefieldEnvironmentColor>,
  points: readonly BattlefieldEnvironmentPoint[],
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
    builder.orientedTriangle(color, center, a, b, outwardX, outwardY, outwardZ);
  }
}

function averagePoints(points: readonly BattlefieldEnvironmentPoint[]): BattlefieldEnvironmentPoint {
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
