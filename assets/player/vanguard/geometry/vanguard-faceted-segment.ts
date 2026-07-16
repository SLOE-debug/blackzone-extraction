import { lerp, TAU } from '../../../core/math/scalar';
import { type TriangleMeshWriter } from '../../../core/geometry/triangle-mesh-writer';
import { type VanguardState } from '../model/vanguard-state';
import { VanguardJoint } from '../model/vanguard-schema';
import {
  type VanguardPartSpec,
  VanguardPartProfile,
} from './vanguard-part-layout';
import {
  VANGUARD_PART_RADIAL_SEGMENTS,
  VANGUARD_PART_RING_COUNT,
} from './vanguard-topology';
import { appendVanguardTriangle } from './vanguard-triangle-geometry';

const EPSILON = 0.000001;
const POINT_COMPONENTS = 3;
const POINT_COUNT = VANGUARD_PART_RADIAL_SEGMENTS * VANGUARD_PART_RING_COUNT;

/** 使用可复用暂存区写入不规则三圈六边截面装甲段。 */
export class VanguardFacetedSegmentWriter {
  private readonly points = new Float64Array(POINT_COUNT * POINT_COMPONENTS);

  /** 将两个关节之间的语义部件写为固定拓扑硬分面网格。 */
  public append(
    writer: TriangleMeshWriter,
    state: VanguardState,
    entityIndex: number,
    spec: Readonly<VanguardPartSpec>,
    scale: number,
  ): void {
    const { joints } = state.data;
    const jointOffset = entityIndex * VanguardJoint.Count;
    const startOffset = jointOffset + spec.start;
    const endOffset = jointOffset + spec.end;
    const startX = joints.x[startOffset] ?? 0;
    const startY = joints.y[startOffset] ?? 0;
    const startZ = joints.z[startOffset] ?? 0;
    const endX = joints.x[endOffset] ?? 0;
    const endY = joints.y[endOffset] ?? 0;
    const endZ = joints.z[endOffset] ?? 0;
    let axisX = endX - startX;
    let axisY = endY - startY;
    let axisZ = endZ - startZ;
    const axisLength = Math.hypot(axisX, axisY, axisZ);
    if (axisLength <= EPSILON) {
      throw new Error(`主角部件关节重合：${spec.id}`);
    }
    axisX /= axisLength;
    axisY /= axisLength;
    axisZ /= axisLength;

    const referenceY = Math.abs(axisY) < 0.9 ? 1 : 0;
    const referenceZ = referenceY === 0 ? 1 : 0;
    let basisUX = referenceY * axisZ - referenceZ * axisY;
    let basisUY = referenceZ * axisX;
    let basisUZ = -referenceY * axisX;
    const basisULength = Math.max(Math.hypot(basisUX, basisUY, basisUZ), EPSILON);
    basisUX /= basisULength;
    basisUY /= basisULength;
    basisUZ /= basisULength;
    const basisVX = axisY * basisUZ - axisZ * basisUY;
    const basisVY = axisZ * basisUX - axisX * basisUZ;
    const basisVZ = axisX * basisUY - axisY * basisUX;

    for (let ring = 0; ring < VANGUARD_PART_RING_COUNT; ring++) {
      const t = ring / (VANGUARD_PART_RING_COUNT - 1);
      const middle = ring === 1;
      const centerOffsetU = middle
        ? jitter(spec.seed, ring, 17, spec.startWidth * getCenterJitter(spec.profile))
        : 0;
      const centerOffsetV = middle
        ? jitter(spec.seed, ring, 23, spec.startDepth * getCenterJitter(spec.profile))
        : 0;
      const centerX = lerp(startX, endX, t) + basisUX * centerOffsetU + basisVX * centerOffsetV;
      const centerY = lerp(startY, endY, t) + basisUY * centerOffsetU + basisVY * centerOffsetV;
      const centerZ = lerp(startZ, endZ, t) + basisUZ * centerOffsetU + basisVZ * centerOffsetV;
      const halfWidth = lerp(spec.startWidth, spec.endWidth, t) * scale
        * (middle ? getMiddleWidthScale(spec.profile) : 1);
      const halfDepth = lerp(spec.startDepth, spec.endDepth, t) * scale
        * (middle ? getMiddleDepthScale(spec.profile) : 1);
      const twist = getAngleOffset(spec.profile)
        + jitter(spec.seed, ring, 31, getTwistAmplitude(spec.profile))
        + ring * getRingTwist(spec.profile);

      for (let radial = 0; radial < VANGUARD_PART_RADIAL_SEGMENTS; radial++) {
        const angle = radial / VANGUARD_PART_RADIAL_SEGMENTS * TAU + twist;
        const radiusScale = 1 + jitter(
          spec.seed,
          ring,
          radial,
          getRadialVariation(spec.profile),
        );
        const alongU = Math.cos(angle) * halfWidth * radiusScale;
        const alongV = Math.sin(angle) * halfDepth * radiusScale;
        const pointOffset = (ring * VANGUARD_PART_RADIAL_SEGMENTS + radial)
          * POINT_COMPONENTS;
        this.points[pointOffset] = centerX + basisUX * alongU + basisVX * alongV;
        this.points[pointOffset + 1] = centerY + basisUY * alongU + basisVY * alongV;
        this.points[pointOffset + 2] = centerZ + basisUZ * alongU + basisVZ * alongV;
      }
    }

    for (let ring = 0; ring < VANGUARD_PART_RING_COUNT - 1; ring++) {
      for (let radial = 0; radial < VANGUARD_PART_RADIAL_SEGMENTS; radial++) {
        const nextRadial = (radial + 1) % VANGUARD_PART_RADIAL_SEGMENTS;
        const lower = ring * VANGUARD_PART_RADIAL_SEGMENTS + radial;
        const lowerNext = ring * VANGUARD_PART_RADIAL_SEGMENTS + nextRadial;
        const upper = lower + VANGUARD_PART_RADIAL_SEGMENTS;
        const upperNext = lowerNext + VANGUARD_PART_RADIAL_SEGMENTS;
        this.appendPointTriangle(writer, lower, upperNext, upper);
        this.appendPointTriangle(writer, lower, lowerNext, upperNext);
      }
    }

    for (let radial = 0; radial < VANGUARD_PART_RADIAL_SEGMENTS; radial++) {
      const nextRadial = (radial + 1) % VANGUARD_PART_RADIAL_SEGMENTS;
      this.appendCenterTriangle(writer, startX, startY, startZ, nextRadial, radial);
      const topStart = (VANGUARD_PART_RING_COUNT - 1) * VANGUARD_PART_RADIAL_SEGMENTS;
      this.appendCenterTriangle(
        writer,
        endX,
        endY,
        endZ,
        topStart + radial,
        topStart + nextRadial,
      );
    }
  }

  /** 从暂存点索引写入一个独立法线三角形。 */
  private appendPointTriangle(
    writer: TriangleMeshWriter,
    a: number,
    b: number,
    c: number,
  ): void {
    const aOffset = a * POINT_COMPONENTS;
    const bOffset = b * POINT_COMPONENTS;
    const cOffset = c * POINT_COMPONENTS;
    appendVanguardTriangle(
      writer,
      this.points[aOffset] ?? 0,
      this.points[aOffset + 1] ?? 0,
      this.points[aOffset + 2] ?? 0,
      this.points[bOffset] ?? 0,
      this.points[bOffset + 1] ?? 0,
      this.points[bOffset + 2] ?? 0,
      this.points[cOffset] ?? 0,
      this.points[cOffset + 1] ?? 0,
      this.points[cOffset + 2] ?? 0,
    );
  }

  /** 使用显式中心点写入部件封口三角形。 */
  private appendCenterTriangle(
    writer: TriangleMeshWriter,
    centerX: number,
    centerY: number,
    centerZ: number,
    b: number,
    c: number,
  ): void {
    const bOffset = b * POINT_COMPONENTS;
    const cOffset = c * POINT_COMPONENTS;
    appendVanguardTriangle(
      writer,
      centerX,
      centerY,
      centerZ,
      this.points[bOffset] ?? 0,
      this.points[bOffset + 1] ?? 0,
      this.points[bOffset + 2] ?? 0,
      this.points[cOffset] ?? 0,
      this.points[cOffset + 1] ?? 0,
      this.points[cOffset + 2] ?? 0,
    );
  }
}

/** 返回不同领域轮廓的中圈横向隆起。 */
function getMiddleWidthScale(profile: VanguardPartProfile): number {
  switch (profile) {
    case VanguardPartProfile.BodyShell:
      return 1.045;
    case VanguardPartProfile.LimbArmor:
      return 1.035;
    case VanguardPartProfile.ArmorPlate:
      return 1.09;
    case VanguardPartProfile.Helmet:
      return 1.025;
    case VanguardPartProfile.Equipment:
      return 1.015;
    case VanguardPartProfile.Boot:
      return 1.06;
    case VanguardPartProfile.Weapon:
      return 1.01;
    case VanguardPartProfile.LightPanel:
      return 1.035;
    default:
      throw new Error(`未知主角部件轮廓：${profile}`);
  }
}

/** 返回不同领域轮廓的中圈纵深隆起。 */
function getMiddleDepthScale(profile: VanguardPartProfile): number {
  switch (profile) {
    case VanguardPartProfile.BodyShell:
      return 1.04;
    case VanguardPartProfile.LimbArmor:
      return 1.025;
    case VanguardPartProfile.ArmorPlate:
      return 0.92;
    case VanguardPartProfile.Helmet:
      return 1.045;
    case VanguardPartProfile.Equipment:
      return 0.98;
    case VanguardPartProfile.Boot:
      return 0.95;
    case VanguardPartProfile.Weapon:
      return 0.97;
    case VanguardPartProfile.LightPanel:
      return 0.9;
    default:
      throw new Error(`未知主角部件轮廓：${profile}`);
  }
}

/** 返回轮廓横截面的基础错角。 */
function getAngleOffset(profile: VanguardPartProfile): number {
  return profile === VanguardPartProfile.Equipment
    || profile === VanguardPartProfile.Weapon
    ? Math.PI / 6
    : 0;
}

/** 返回静态不规则中心偏移幅度。 */
function getCenterJitter(profile: VanguardPartProfile): number {
  return profile === VanguardPartProfile.Equipment
    || profile === VanguardPartProfile.Weapon
    || profile === VanguardPartProfile.LightPanel
    ? 0.018
    : 0.035;
}

/** 返回每圈确定性错角幅度。 */
function getTwistAmplitude(profile: VanguardPartProfile): number {
  return profile === VanguardPartProfile.Equipment
    || profile === VanguardPartProfile.Weapon
    ? 0.025
    : 0.055;
}

/** 返回沿部件长度累积的轻微截面旋转。 */
function getRingTwist(profile: VanguardPartProfile): number {
  return profile === VanguardPartProfile.ArmorPlate
    || profile === VanguardPartProfile.LightPanel
    ? 0.012
    : 0.025;
}

/** 返回截面各方向的确定性半径差异。 */
function getRadialVariation(profile: VanguardPartProfile): number {
  return profile === VanguardPartProfile.Equipment
    || profile === VanguardPartProfile.Weapon
    || profile === VanguardPartProfile.LightPanel
    ? 0.025
    : 0.055;
}

/** 返回不依赖运行时随机状态的确定性扰动。 */
function jitter(seed: number, ring: number, radial: number, amplitude: number): number {
  const value = Math.sin(seed * 41.73 + ring * 17.17 + radial * 73.91) * 43758.5453;
  const fraction = value - Math.floor(value);
  return (fraction * 2 - 1) * amplitude;
}
