import {
  getVenomLobberLegJointIndex,
  VENOM_LOBBER_LEG_COUNT,
  VENOM_LOBBER_LEG_JOINT_COUNT,
  VENOM_LOBBER_LEG_PATHS,
  VENOM_LOBBER_LEG_SEGMENT_COUNT,
} from '../model/venom-lobber-leg-rig';
import { type VenomLobberState } from '../model/venom-lobber-state';

const ROTATION_COUNT = VENOM_LOBBER_LEG_COUNT * VENOM_LOBBER_LEG_SEGMENT_COUNT;

/** 把解析 IK 关节流编译成刚性腿段旋转，并原地求值单个绑定顶点。 */
export class VenomLobberLegGeometryDeformer {
  private readonly rotationX = new Float32Array(ROTATION_COUNT);
  private readonly rotationY = new Float32Array(ROTATION_COUNT);
  private readonly rotationZ = new Float32Array(ROTATION_COUNT);
  private readonly rotationW = new Float32Array(ROTATION_COUNT);
  private readonly posedPivotX = new Float32Array(ROTATION_COUNT);
  private readonly posedPivotY = new Float32Array(ROTATION_COUNT);
  private readonly posedPivotZ = new Float32Array(ROTATION_COUNT);
  public x = 0;
  public y = 0;
  public z = 0;

  /** 为一个实体的十八个腿段预计算无分配四元数与姿态 Pivot。 */
  public prepare(state: VenomLobberState, entityIndex: number): void {
    const animation = state.data.animation;
    const entityJointOffset = entityIndex * VENOM_LOBBER_LEG_COUNT
      * VENOM_LOBBER_LEG_JOINT_COUNT;
    for (let legId = 0; legId < VENOM_LOBBER_LEG_COUNT; legId++) {
      const path = VENOM_LOBBER_LEG_PATHS[legId];
      if (path === undefined) {
        continue;
      }
      for (let segmentId = 0; segmentId < VENOM_LOBBER_LEG_SEGMENT_COUNT; segmentId++) {
        const rotationIndex = legId * VENOM_LOBBER_LEG_SEGMENT_COUNT + segmentId;
        const restStart = path[segmentId];
        const restEnd = path[segmentId + 1];
        if (restStart === undefined || restEnd === undefined) {
          continue;
        }
        const posedStartIndex = entityJointOffset
          + getVenomLobberLegJointIndex(legId, segmentId);
        const posedEndIndex = posedStartIndex + 1;
        const posedStartX = animation.legJointX[posedStartIndex] ?? restStart[0];
        const posedStartY = animation.legJointY[posedStartIndex] ?? restStart[1];
        const posedStartZ = animation.legJointZ[posedStartIndex] ?? restStart[2];
        this.posedPivotX[rotationIndex] = posedStartX;
        this.posedPivotY[rotationIndex] = posedStartY;
        this.posedPivotZ[rotationIndex] = posedStartZ;
        writeFromToRotation(
          restEnd[0] - restStart[0],
          restEnd[1] - restStart[1],
          restEnd[2] - restStart[2],
          (animation.legJointX[posedEndIndex] ?? restEnd[0]) - posedStartX,
          (animation.legJointY[posedEndIndex] ?? restEnd[1]) - posedStartY,
          (animation.legJointZ[posedEndIndex] ?? restEnd[2]) - posedStartZ,
          rotationIndex,
          this.rotationX,
          this.rotationY,
          this.rotationZ,
          this.rotationW,
        );
      }
    }
  }

  /** 使用对应刚性段四元数变换一个源模型顶点。 */
  public transform(
    sourceX: number,
    sourceY: number,
    sourceZ: number,
    legId: number,
    segmentId: number,
  ): void {
    const zeroBasedLeg = legId - 1;
    const zeroBasedSegment = segmentId - 1;
    const path = VENOM_LOBBER_LEG_PATHS[zeroBasedLeg];
    const restPivot = path?.[zeroBasedSegment];
    if (restPivot === undefined) {
      this.x = sourceX;
      this.y = sourceY;
      this.z = sourceZ;
      return;
    }
    const rotationIndex = zeroBasedLeg * VENOM_LOBBER_LEG_SEGMENT_COUNT
      + zeroBasedSegment;
    const relativeX = sourceX - restPivot[0];
    const relativeY = sourceY - restPivot[1];
    const relativeZ = sourceZ - restPivot[2];
    const quaternionX = this.rotationX[rotationIndex] ?? 0;
    const quaternionY = this.rotationY[rotationIndex] ?? 0;
    const quaternionZ = this.rotationZ[rotationIndex] ?? 0;
    const quaternionW = this.rotationW[rotationIndex] ?? 1;
    const crossX = quaternionY * relativeZ - quaternionZ * relativeY;
    const crossY = quaternionZ * relativeX - quaternionX * relativeZ;
    const crossZ = quaternionX * relativeY - quaternionY * relativeX;
    const secondCrossX = quaternionY * crossZ - quaternionZ * crossY;
    const secondCrossY = quaternionZ * crossX - quaternionX * crossZ;
    const secondCrossZ = quaternionX * crossY - quaternionY * crossX;
    this.x = (this.posedPivotX[rotationIndex] ?? restPivot[0])
      + relativeX + 2 * (quaternionW * crossX + secondCrossX);
    this.y = (this.posedPivotY[rotationIndex] ?? restPivot[1])
      + relativeY + 2 * (quaternionW * crossY + secondCrossY);
    this.z = (this.posedPivotZ[rotationIndex] ?? restPivot[2])
      + relativeZ + 2 * (quaternionW * crossZ + secondCrossZ);
  }
}

function writeFromToRotation(
  fromX: number,
  fromY: number,
  fromZ: number,
  toX: number,
  toY: number,
  toZ: number,
  index: number,
  outputX: Float32Array,
  outputY: Float32Array,
  outputZ: Float32Array,
  outputW: Float32Array,
): void {
  const inverseFrom = 1 / Math.max(Math.hypot(fromX, fromY, fromZ), 0.0001);
  const inverseTo = 1 / Math.max(Math.hypot(toX, toY, toZ), 0.0001);
  const normalizedFromX = fromX * inverseFrom;
  const normalizedFromY = fromY * inverseFrom;
  const normalizedFromZ = fromZ * inverseFrom;
  const normalizedToX = toX * inverseTo;
  const normalizedToY = toY * inverseTo;
  const normalizedToZ = toZ * inverseTo;
  const crossX = normalizedFromY * normalizedToZ - normalizedFromZ * normalizedToY;
  const crossY = normalizedFromZ * normalizedToX - normalizedFromX * normalizedToZ;
  const crossZ = normalizedFromX * normalizedToY - normalizedFromY * normalizedToX;
  const dot = normalizedFromX * normalizedToX
    + normalizedFromY * normalizedToY
    + normalizedFromZ * normalizedToZ;
  if (dot < -0.9999) {
    const axisX = Math.abs(normalizedFromX) < 0.8 ? 0 : -normalizedFromZ;
    const axisY = Math.abs(normalizedFromX) < 0.8 ? normalizedFromZ : 0;
    const axisZ = Math.abs(normalizedFromX) < 0.8 ? -normalizedFromY : normalizedFromX;
    const inverseAxis = 1 / Math.max(Math.hypot(axisX, axisY, axisZ), 0.0001);
    outputX[index] = axisX * inverseAxis;
    outputY[index] = axisY * inverseAxis;
    outputZ[index] = axisZ * inverseAxis;
    outputW[index] = 0;
    return;
  }
  const inverseQuaternion = 1 / Math.max(
    Math.hypot(crossX, crossY, crossZ, 1 + dot),
    0.0001,
  );
  outputX[index] = crossX * inverseQuaternion;
  outputY[index] = crossY * inverseQuaternion;
  outputZ[index] = crossZ * inverseQuaternion;
  outputW[index] = (1 + dot) * inverseQuaternion;
}
