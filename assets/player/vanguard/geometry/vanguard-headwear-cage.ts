import { VanguardBone } from '../model/vanguard-bone';
import { VanguardCageBuilder, type VanguardCageDefinition } from './vanguard-cage';
import { VanguardMatteSurface } from './vanguard-surface';

interface HeadwearRingPoint {
  readonly x: number;
  readonly z: number;
  readonly yOffset: number;
}

const BRIM_OUTER_RING = Object.freeze([
  point(-0.015, 0.46, -0.17),
  point(0.4, 0.38, -0.1),
  point(0.68, 0.19, 0.12),
  point(0.63, -0.16, 0.255),
  point(0.28, -0.34, 0.15),
  point(-0.015, -0.4, 0.12),
  point(-0.3, -0.35, 0.13),
  point(-0.66, -0.15, 0.24),
  point(-0.69, 0.18, 0.11),
  point(-0.39, 0.39, -0.09),
] satisfies readonly HeadwearRingPoint[]);

const CROWN_BASE_RING = Object.freeze([
  point(-0.008, 0.225, -0.02),
  point(0.2, 0.18, -0.012),
  point(0.3, 0.065, 0.008),
  point(0.285, -0.15, 0.016),
  point(0.13, -0.24, 0.014),
  point(-0.008, -0.27, 0.012),
  point(-0.145, -0.25, 0.01),
  point(-0.3, -0.135, 0.012),
  point(-0.29, 0.08, 0.004),
  point(-0.195, 0.19, -0.008),
] satisfies readonly HeadwearRingPoint[]);

const CROWN_PINCH_RING = Object.freeze([
  point(-0.006, 0.15, -0.035),
  point(0.115, 0.13, -0.02),
  point(0.255, 0.04, 0.02),
  point(0.245, -0.14, 0.035),
  point(0.11, -0.21, 0.03),
  point(-0.005, -0.235, 0.025),
  point(-0.12, -0.215, 0.025),
  point(-0.26, -0.13, 0.03),
  point(-0.25, 0.04, 0.015),
  point(-0.11, 0.135, -0.012),
] satisfies readonly HeadwearRingPoint[]);

const CROWN_TOP_RING = Object.freeze([
  point(-0.004, 0.12, -0.025),
  point(0.095, 0.105, -0.008),
  point(0.2, 0.035, 0.07),
  point(0.18, -0.12, 0.102),
  point(0.07, -0.18, 0.066),
  point(-0.006, -0.2, 0.055),
  point(-0.085, -0.185, 0.058),
  point(-0.195, -0.1, 0.096),
  point(-0.2, 0.035, 0.064),
  point(-0.09, 0.11, -0.005),
] satisfies readonly HeadwearRingPoint[]);

/** 构建具有前低侧卷帽檐和夹折凹冠的荒原猎手帽。 */
function createVanguardHeadwearCage(): VanguardCageDefinition {
  const builder = new VanguardCageBuilder(VanguardMatteSurface.Count);
  const outerTop = addRing(builder, BRIM_OUTER_RING, 3.76);
  const outerBottom = addRing(builder, BRIM_OUTER_RING, 3.705);
  const innerTop = addRing(builder, CROWN_BASE_RING, 3.765);
  const innerBottom = addRing(builder, CROWN_BASE_RING, 3.71);
  const crownPinch = addRing(builder, CROWN_PINCH_RING, 3.945);
  const crownTop = addRing(builder, CROWN_TOP_RING, 4.1);

  connectAnnulus(builder, outerTop, innerTop, 1);
  connectAnnulus(builder, innerBottom, outerBottom, -1);
  connectRingWalls(builder, outerTop, outerBottom, BRIM_OUTER_RING, 1);
  connectRingWalls(builder, innerBottom, innerTop, CROWN_BASE_RING, -1);
  connectCrown(builder, innerTop, crownPinch, CROWN_BASE_RING);
  connectCrown(builder, crownPinch, crownTop, CROWN_PINCH_RING);
  const bandLower = addScaledRing(builder, CROWN_BASE_RING, 3.79, 1.025);
  const bandUpper = addScaledRing(builder, CROWN_BASE_RING, 3.838, 1.018);
  connectHatBand(builder, bandLower, bandUpper, CROWN_BASE_RING);
  capPinchedCrown(builder, crownTop);
  return builder.build();
}

/** 以纵向双凹点封闭帽冠，形成牛仔帽可读的夹折顶面。 */
function capPinchedCrown(
  builder: VanguardCageBuilder,
  crownTop: readonly number[],
): void {
  const creaseFront = builder.vertex(-0.016, 4.115, 0.048, VanguardBone.Head);
  const creaseBack = builder.vertex(0.014, 4.122, -0.108, VanguardBone.Head);
  const top = (index: number): number => crownTop[index] ?? 0;

  builder.orientedTriangle(VanguardMatteSurface.Headwear, top(9), top(0), creaseFront, 0, 1, 0);
  builder.orientedTriangle(VanguardMatteSurface.Headwear, top(0), top(1), creaseFront, 0, 1, 0);
  builder.orientedTriangle(VanguardMatteSurface.Headwear, top(1), top(2), creaseFront, 0, 1, 0);
  builder.orientedQuad(
    VanguardMatteSurface.Headwear,
    top(2),
    top(3),
    creaseBack,
    creaseFront,
    0,
    1,
    0,
    0.012,
  );
  builder.orientedTriangle(VanguardMatteSurface.Headwear, top(3), top(4), creaseBack, 0, 1, 0);
  builder.orientedTriangle(VanguardMatteSurface.Headwear, top(4), top(5), creaseBack, 0, 1, 0);
  builder.orientedTriangle(VanguardMatteSurface.Headwear, top(5), top(6), creaseBack, 0, 1, 0);
  builder.orientedTriangle(VanguardMatteSurface.Headwear, top(6), top(7), creaseBack, 0, 1, 0);
  builder.orientedQuad(
    VanguardMatteSurface.Headwear,
    top(7),
    top(8),
    creaseFront,
    creaseBack,
    0,
    1,
    0,
    0.012,
  );
  builder.orientedTriangle(VanguardMatteSurface.Headwear, top(8), top(9), creaseFront, 0, 1, 0);
}

function addRing(
  builder: VanguardCageBuilder,
  points: readonly HeadwearRingPoint[],
  baseY: number,
): readonly number[] {
  return Object.freeze(points.map((ringPoint) => builder.vertex(
    ringPoint.x,
    baseY + ringPoint.yOffset,
    ringPoint.z,
    VanguardBone.Head,
  )));
}

function addScaledRing(
  builder: VanguardCageBuilder,
  points: readonly HeadwearRingPoint[],
  baseY: number,
  scale: number,
): readonly number[] {
  return Object.freeze(points.map((ringPoint) => builder.vertex(
    ringPoint.x * scale,
    baseY + ringPoint.yOffset * 0.35,
    ringPoint.z * scale,
    VanguardBone.Head,
  )));
}

function connectAnnulus(
  builder: VanguardCageBuilder,
  outer: readonly number[],
  inner: readonly number[],
  outwardY: -1 | 1,
): void {
  for (let index = 0; index < outer.length; index++) {
    const next = (index + 1) % outer.length;
    builder.orientedQuad(
      VanguardMatteSurface.Headwear,
      outer[index] ?? 0,
      outer[next] ?? 0,
      inner[next] ?? 0,
      inner[index] ?? 0,
      0,
      outwardY,
      0,
      0.006 + index % 3 * 0.001,
    );
  }
}

function connectRingWalls(
  builder: VanguardCageBuilder,
  upper: readonly number[],
  lower: readonly number[],
  points: readonly HeadwearRingPoint[],
  outwardScale: -1 | 1,
): void {
  for (let index = 0; index < upper.length; index++) {
    const next = (index + 1) % upper.length;
    const currentPoint = points[index];
    const nextPoint = points[next];
    if (currentPoint === undefined || nextPoint === undefined) {
      throw new Error('猎手帽边缘轮廓点不存在。');
    }
    builder.orientedQuad(
      VanguardMatteSurface.Headwear,
      upper[index] ?? 0,
      lower[index] ?? 0,
      lower[next] ?? 0,
      upper[next] ?? 0,
      (currentPoint.x + nextPoint.x) * outwardScale,
      0,
      (currentPoint.z + nextPoint.z) * outwardScale,
      0.003,
    );
  }
}

function connectCrown(
  builder: VanguardCageBuilder,
  lower: readonly number[],
  upper: readonly number[],
  lowerPoints: readonly HeadwearRingPoint[],
): void {
  for (let index = 0; index < lower.length; index++) {
    const next = (index + 1) % lower.length;
    const currentPoint = lowerPoints[index];
    const nextPoint = lowerPoints[next];
    if (currentPoint === undefined || nextPoint === undefined) {
      throw new Error('猎手帽冠部轮廓点不存在。');
    }
    builder.orientedQuad(
      VanguardMatteSurface.Headwear,
      lower[index] ?? 0,
      lower[next] ?? 0,
      upper[next] ?? 0,
      upper[index] ?? 0,
      currentPoint.x + nextPoint.x,
      0.15,
      currentPoint.z + nextPoint.z,
      0.007 + index % 2 * 0.001,
    );
  }
}

function connectHatBand(
  builder: VanguardCageBuilder,
  lower: readonly number[],
  upper: readonly number[],
  points: readonly HeadwearRingPoint[],
): void {
  for (let index = 0; index < lower.length; index++) {
    const next = (index + 1) % lower.length;
    const currentPoint = points[index];
    const nextPoint = points[next];
    if (currentPoint === undefined || nextPoint === undefined) {
      throw new Error('猎手帽饰带轮廓点不存在。');
    }
    builder.orientedQuad(
      VanguardMatteSurface.Leather,
      lower[index] ?? 0,
      lower[next] ?? 0,
      upper[next] ?? 0,
      upper[index] ?? 0,
      currentPoint.x + nextPoint.x,
      0,
      currentPoint.z + nextPoint.z,
      0.004,
    );
  }
}

function point(x: number, z: number, yOffset: number): HeadwearRingPoint {
  return Object.freeze({ x, z, yOffset });
}

/** 主角荒原猎手帽固定拓扑。 */
export const VANGUARD_HEADWEAR_CAGE = createVanguardHeadwearCage();
