import { type TriangleMeshWriter } from '../../../core/geometry/triangle-mesh-writer';
import { TAU } from '../../../core/math/scalar';
import { VanguardJoint } from '../model/vanguard-schema';
import { type VanguardState } from '../model/vanguard-state';
import { VANGUARD_EYE_RING_SEGMENTS } from './vanguard-topology';
import { appendVanguardTriangle } from './vanguard-triangle-geometry';

const RING_COUNT = 4;
const POINT_COMPONENTS = 3;

/** 使用可复用暂存区写入参考图中的白色独眼环形灯。 */
export class VanguardEyeRingGeometryWriter {
  private readonly points = new Float64Array(
    VANGUARD_EYE_RING_SEGMENTS * RING_COUNT * POINT_COMPONENTS,
  );

  /** 围绕眼睛前向轴写入低段数不规则环形壳体。 */
  public write(
    writer: TriangleMeshWriter,
    state: VanguardState,
    entityIndex: number,
    scale: number,
  ): void {
    const { joints } = state.data;
    const jointOffset = entityIndex * VanguardJoint.Count;
    const backOffset = jointOffset + VanguardJoint.EyeInner;
    const frontOffset = jointOffset + VanguardJoint.EyeOuter;
    const backX = joints.x[backOffset] ?? 0;
    const backY = joints.y[backOffset] ?? 0;
    const backZ = joints.z[backOffset] ?? 0;
    const frontX = joints.x[frontOffset] ?? 0;
    const frontY = joints.y[frontOffset] ?? 0;
    const frontZ = joints.z[frontOffset] ?? 0;
    let axisX = frontX - backX;
    let axisY = frontY - backY;
    let axisZ = frontZ - backZ;
    const axisLength = Math.max(Math.hypot(axisX, axisY, axisZ), 0.000001);
    axisX /= axisLength;
    axisY /= axisLength;
    axisZ /= axisLength;

    const referenceY = Math.abs(axisY) < 0.9 ? 1 : 0;
    const referenceZ = referenceY === 0 ? 1 : 0;
    let basisUX = referenceY * axisZ - referenceZ * axisY;
    let basisUY = referenceZ * axisX;
    let basisUZ = -referenceY * axisX;
    const basisLength = Math.max(Math.hypot(basisUX, basisUY, basisUZ), 0.000001);
    basisUX /= basisLength;
    basisUY /= basisLength;
    basisUZ /= basisLength;
    const basisVX = axisY * basisUZ - axisZ * basisUY;
    const basisVY = axisZ * basisUX - axisX * basisUZ;
    const basisVZ = axisX * basisUY - axisY * basisUX;

    this.writeRing(0, backX, backY, backZ, 0.158 * scale, basisUX, basisUY, basisUZ, basisVX, basisVY, basisVZ);
    this.writeRing(1, frontX, frontY, frontZ, 0.185 * scale, basisUX, basisUY, basisUZ, basisVX, basisVY, basisVZ);
    this.writeRing(2, backX, backY, backZ, 0.087 * scale, basisUX, basisUY, basisUZ, basisVX, basisVY, basisVZ);
    this.writeRing(3, frontX, frontY, frontZ, 0.105 * scale, basisUX, basisUY, basisUZ, basisVX, basisVY, basisVZ);

    for (let segment = 0; segment < VANGUARD_EYE_RING_SEGMENTS; segment++) {
      const next = (segment + 1) % VANGUARD_EYE_RING_SEGMENTS;
      const outerBack = segment;
      const outerBackNext = next;
      const outerFront = VANGUARD_EYE_RING_SEGMENTS + segment;
      const outerFrontNext = VANGUARD_EYE_RING_SEGMENTS + next;
      const innerBack = VANGUARD_EYE_RING_SEGMENTS * 2 + segment;
      const innerBackNext = VANGUARD_EYE_RING_SEGMENTS * 2 + next;
      const innerFront = VANGUARD_EYE_RING_SEGMENTS * 3 + segment;
      const innerFrontNext = VANGUARD_EYE_RING_SEGMENTS * 3 + next;

      this.appendTriangle(writer, outerBack, outerFrontNext, outerFront);
      this.appendTriangle(writer, outerBack, outerBackNext, outerFrontNext);
      this.appendTriangle(writer, innerBack, innerFront, innerFrontNext);
      this.appendTriangle(writer, innerBack, innerFrontNext, innerBackNext);
      this.appendTriangle(writer, outerFront, outerFrontNext, innerFrontNext);
      this.appendTriangle(writer, outerFront, innerFrontNext, innerFront);
      this.appendTriangle(writer, outerBack, innerBackNext, outerBackNext);
      this.appendTriangle(writer, outerBack, innerBack, innerBackNext);
    }
  }

  /** 写入单圈确定性不等半径轮廓。 */
  private writeRing(
    ring: number,
    centerX: number,
    centerY: number,
    centerZ: number,
    radius: number,
    basisUX: number,
    basisUY: number,
    basisUZ: number,
    basisVX: number,
    basisVY: number,
    basisVZ: number,
  ): void {
    for (let segment = 0; segment < VANGUARD_EYE_RING_SEGMENTS; segment++) {
      const angle = segment / VANGUARD_EYE_RING_SEGMENTS * TAU + ring * 0.018;
      const irregularRadius = radius * (1 + Math.sin(segment * 13.7 + ring * 5.9) * 0.018);
      const alongU = Math.cos(angle) * irregularRadius;
      const alongV = Math.sin(angle) * irregularRadius;
      const offset = (ring * VANGUARD_EYE_RING_SEGMENTS + segment) * POINT_COMPONENTS;
      this.points[offset] = centerX + basisUX * alongU + basisVX * alongV;
      this.points[offset + 1] = centerY + basisUY * alongU + basisVY * alongV;
      this.points[offset + 2] = centerZ + basisUZ * alongU + basisVZ * alongV;
    }
  }

  /** 从暂存点索引写入一个硬分面三角形。 */
  private appendTriangle(
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
}
