import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
} from '../model/vanguard-bone';
import { VanguardForwardKinematics, type VanguardRigTransform } from './vanguard-forward-kinematics';
import { VANGUARD_BONE_PARENTS } from './vanguard-rig';
import {
  invertQuaternion,
  multiplyQuaternions,
  slerpQuaternions,
  VANGUARD_QUATERNION_COMPONENTS,
  writeFromToQuaternion,
} from './vanguard-pose-math';
import { writeMatrixRotationQuaternion } from './vanguard-affine-matrix';

const EPSILON = 0.000001;

/**
 * 使用解析关节位置与四元数增量解算一条三关节链。
 *
 * 求解目标是末端骨骼的起点，例如腿链为髋、膝、踝，手臂链为肩、肘、腕。
 */
export class VanguardTwoBoneIkSolver {
  private readonly currentWorldRotation = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  private readonly desiredWorldRotation = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  private readonly parentWorldRotation = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  private readonly inverseParentRotation = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  private readonly rotationDelta = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  private readonly blendedWorldRotation = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);

  constructor(private readonly forwardKinematics: VanguardForwardKinematics) {}

  /** 将末端关节拉向世界目标，并用世界 Pole 决定肘或膝的弯曲平面。 */
  public solve(
    localPositions: Float32Array,
    localRotations: Float32Array,
    matrices: Float32Array,
    entityIndex: number,
    proximalBone: VanguardBone,
    middleBone: VanguardBone,
    endBone: VanguardBone,
    targetX: number,
    targetY: number,
    targetZ: number,
    poleX: number,
    poleY: number,
    poleZ: number,
    weight: number,
    transform: Readonly<VanguardRigTransform>,
  ): void {
    const clampedWeight = clamp01(weight);
    if (clampedWeight <= EPSILON) {
      return;
    }
    const entityMatrixOffset = entityIndex
      * VanguardBone.Count
      * VANGUARD_BONE_MATRIX_COMPONENTS;
    const proximalOffset = entityMatrixOffset
      + proximalBone * VANGUARD_BONE_MATRIX_COMPONENTS;
    const middleOffset = entityMatrixOffset
      + middleBone * VANGUARD_BONE_MATRIX_COMPONENTS;
    const endOffset = entityMatrixOffset
      + endBone * VANGUARD_BONE_MATRIX_COMPONENTS;
    const rootX = matrices[proximalOffset + 9] ?? 0;
    const rootY = matrices[proximalOffset + 10] ?? 0;
    const rootZ = matrices[proximalOffset + 11] ?? 0;
    const currentMiddleX = matrices[middleOffset + 9] ?? 0;
    const currentMiddleY = matrices[middleOffset + 10] ?? 0;
    const currentMiddleZ = matrices[middleOffset + 11] ?? 0;
    const currentEndX = matrices[endOffset + 9] ?? 0;
    const currentEndY = matrices[endOffset + 10] ?? 0;
    const currentEndZ = matrices[endOffset + 11] ?? 0;
    const blendedTargetX = currentEndX + (targetX - currentEndX) * clampedWeight;
    const blendedTargetY = currentEndY + (targetY - currentEndY) * clampedWeight;
    const blendedTargetZ = currentEndZ + (targetZ - currentEndZ) * clampedWeight;
    const upperLength = Math.max(Math.hypot(
      currentMiddleX - rootX,
      currentMiddleY - rootY,
      currentMiddleZ - rootZ,
    ), EPSILON);
    const lowerLength = Math.max(Math.hypot(
      currentEndX - currentMiddleX,
      currentEndY - currentMiddleY,
      currentEndZ - currentMiddleZ,
    ), EPSILON);
    let targetDirectionX = blendedTargetX - rootX;
    let targetDirectionY = blendedTargetY - rootY;
    let targetDirectionZ = blendedTargetZ - rootZ;
    const rawTargetDistance = Math.hypot(
      targetDirectionX,
      targetDirectionY,
      targetDirectionZ,
    );
    const targetDistance = Math.max(
      Math.abs(upperLength - lowerLength) + EPSILON,
      Math.min(rawTargetDistance, upperLength + lowerLength - EPSILON),
    );
    const inverseRawTargetDistance = 1 / Math.max(rawTargetDistance, EPSILON);
    targetDirectionX *= inverseRawTargetDistance;
    targetDirectionY *= inverseRawTargetDistance;
    targetDirectionZ *= inverseRawTargetDistance;

    let poleDirectionX = poleX - rootX;
    let poleDirectionY = poleY - rootY;
    let poleDirectionZ = poleZ - rootZ;
    const poleAlongTarget = poleDirectionX * targetDirectionX
      + poleDirectionY * targetDirectionY
      + poleDirectionZ * targetDirectionZ;
    poleDirectionX -= targetDirectionX * poleAlongTarget;
    poleDirectionY -= targetDirectionY * poleAlongTarget;
    poleDirectionZ -= targetDirectionZ * poleAlongTarget;
    let poleLength = Math.hypot(poleDirectionX, poleDirectionY, poleDirectionZ);
    if (poleLength <= EPSILON) {
      poleDirectionX = currentMiddleX - rootX;
      poleDirectionY = currentMiddleY - rootY;
      poleDirectionZ = currentMiddleZ - rootZ;
      const currentAlongTarget = poleDirectionX * targetDirectionX
        + poleDirectionY * targetDirectionY
        + poleDirectionZ * targetDirectionZ;
      poleDirectionX -= targetDirectionX * currentAlongTarget;
      poleDirectionY -= targetDirectionY * currentAlongTarget;
      poleDirectionZ -= targetDirectionZ * currentAlongTarget;
      poleLength = Math.hypot(poleDirectionX, poleDirectionY, poleDirectionZ);
    }
    if (poleLength <= EPSILON) {
      poleDirectionX = -targetDirectionY;
      poleDirectionY = targetDirectionX;
      poleDirectionZ = 0;
      poleLength = Math.hypot(poleDirectionX, poleDirectionY, poleDirectionZ);
      if (poleLength <= EPSILON) {
        poleDirectionX = 1;
        poleDirectionY = 0;
        poleDirectionZ = 0;
        poleLength = 1;
      }
    }
    poleDirectionX /= poleLength;
    poleDirectionY /= poleLength;
    poleDirectionZ /= poleLength;
    const middleAlongTarget = (
      upperLength * upperLength
        - lowerLength * lowerLength
        + targetDistance * targetDistance
    ) / (2 * targetDistance);
    const middlePerpendicular = Math.sqrt(Math.max(
      0,
      upperLength * upperLength - middleAlongTarget * middleAlongTarget,
    ));
    const desiredMiddleX = rootX
      + targetDirectionX * middleAlongTarget
      + poleDirectionX * middlePerpendicular;
    const desiredMiddleY = rootY
      + targetDirectionY * middleAlongTarget
      + poleDirectionY * middlePerpendicular;
    const desiredMiddleZ = rootZ
      + targetDirectionZ * middleAlongTarget
      + poleDirectionZ * middlePerpendicular;

    this.rotateBoneToward(
      localRotations,
      matrices,
      entityIndex,
      proximalBone,
      currentMiddleX - rootX,
      currentMiddleY - rootY,
      currentMiddleZ - rootZ,
      desiredMiddleX - rootX,
      desiredMiddleY - rootY,
      desiredMiddleZ - rootZ,
    );
    this.forwardKinematics.writeWorldPose(
      localPositions,
      localRotations,
      matrices,
      entityIndex,
      transform,
    );

    const solvedMiddleOffset = entityMatrixOffset
      + middleBone * VANGUARD_BONE_MATRIX_COMPONENTS;
    const solvedEndOffset = entityMatrixOffset
      + endBone * VANGUARD_BONE_MATRIX_COMPONENTS;
    const solvedMiddleX = matrices[solvedMiddleOffset + 9] ?? 0;
    const solvedMiddleY = matrices[solvedMiddleOffset + 10] ?? 0;
    const solvedMiddleZ = matrices[solvedMiddleOffset + 11] ?? 0;
    const solvedEndX = matrices[solvedEndOffset + 9] ?? 0;
    const solvedEndY = matrices[solvedEndOffset + 10] ?? 0;
    const solvedEndZ = matrices[solvedEndOffset + 11] ?? 0;
    this.rotateBoneToward(
      localRotations,
      matrices,
      entityIndex,
      middleBone,
      solvedEndX - solvedMiddleX,
      solvedEndY - solvedMiddleY,
      solvedEndZ - solvedMiddleZ,
      blendedTargetX - solvedMiddleX,
      blendedTargetY - solvedMiddleY,
      blendedTargetZ - solvedMiddleZ,
    );
    this.forwardKinematics.writeWorldPose(
      localPositions,
      localRotations,
      matrices,
      entityIndex,
      transform,
    );
  }

  /** 只改变一根骨骼的世界朝向，使其局部 Y 轴平滑对齐目标方向。 */
  public alignBoneYAxis(
    localPositions: Float32Array,
    localRotations: Float32Array,
    matrices: Float32Array,
    entityIndex: number,
    bone: VanguardBone,
    directionX: number,
    directionY: number,
    directionZ: number,
    weight: number,
    transform: Readonly<VanguardRigTransform>,
  ): void {
    const matrixOffset = entityIndex
      * VanguardBone.Count
      * VANGUARD_BONE_MATRIX_COMPONENTS
      + bone * VANGUARD_BONE_MATRIX_COMPONENTS;
    this.rotateBoneToward(
      localRotations,
      matrices,
      entityIndex,
      bone,
      matrices[matrixOffset + 3] ?? 0,
      matrices[matrixOffset + 4] ?? 1,
      matrices[matrixOffset + 5] ?? 0,
      directionX,
      directionY,
      directionZ,
      weight,
    );
    this.forwardKinematics.writeWorldPose(
      localPositions,
      localRotations,
      matrices,
      entityIndex,
      transform,
    );
  }

  private rotateBoneToward(
    localRotations: Float32Array,
    matrices: Float32Array,
    entityIndex: number,
    bone: VanguardBone,
    currentDirectionX: number,
    currentDirectionY: number,
    currentDirectionZ: number,
    desiredDirectionX: number,
    desiredDirectionY: number,
    desiredDirectionZ: number,
    weight = 1,
  ): void {
    const entityMatrixOffset = entityIndex
      * VanguardBone.Count
      * VANGUARD_BONE_MATRIX_COMPONENTS;
    const boneMatrixOffset = entityMatrixOffset
      + bone * VANGUARD_BONE_MATRIX_COMPONENTS;
    writeFromToQuaternion(
      this.rotationDelta,
      0,
      currentDirectionX,
      currentDirectionY,
      currentDirectionZ,
      desiredDirectionX,
      desiredDirectionY,
      desiredDirectionZ,
    );
    writeMatrixRotationQuaternion(
      this.currentWorldRotation,
      0,
      matrices,
      boneMatrixOffset,
    );
    multiplyQuaternions(
      this.desiredWorldRotation,
      0,
      this.rotationDelta,
      0,
      this.currentWorldRotation,
      0,
    );
    const clampedWeight = clamp01(weight);
    if (clampedWeight < 1 - EPSILON) {
      slerpQuaternions(
        this.blendedWorldRotation,
        0,
        this.currentWorldRotation,
        0,
        this.desiredWorldRotation,
        0,
        clampedWeight,
      );
    } else {
      this.blendedWorldRotation.set(this.desiredWorldRotation);
    }
    const parent = VANGUARD_BONE_PARENTS[bone] ?? -1;
    if (parent < 0) {
      throw new Error('双骨 IK 不允许直接修改角色逻辑根骨骼。');
    }
    writeMatrixRotationQuaternion(
      this.parentWorldRotation,
      0,
      matrices,
      entityMatrixOffset + parent * VANGUARD_BONE_MATRIX_COMPONENTS,
    );
    invertQuaternion(
      this.inverseParentRotation,
      0,
      this.parentWorldRotation,
      0,
    );
    const localRotationOffset = entityIndex
      * VanguardBone.Count
      * VANGUARD_QUATERNION_COMPONENTS
      + bone * VANGUARD_QUATERNION_COMPONENTS;
    multiplyQuaternions(
      localRotations,
      localRotationOffset,
      this.inverseParentRotation,
      0,
      this.blendedWorldRotation,
      0,
    );
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
