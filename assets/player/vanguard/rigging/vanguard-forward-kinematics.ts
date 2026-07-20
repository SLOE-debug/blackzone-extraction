import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
  type VanguardBoneMatrixArray,
} from '../model/vanguard-bone';
import {
  multiplyQuaternionComponents,
  VANGUARD_QUATERNION_COMPONENTS,
  writeAxisAngleQuaternion,
} from './vanguard-pose-math';
import { writeAffineMatrix } from './vanguard-affine-matrix';
import {
  VANGUARD_BONE_PARENTS,
  VANGUARD_LOCAL_POSITION_COMPONENTS,
} from './vanguard-rig';

/** 把角色实体根变换应用到局部骨架所需的稳定输入。 */
export interface VanguardRigTransform {
  readonly positionX: number;
  readonly positionY: number;
  readonly positionZ: number;
  readonly heading: number;
  readonly scale: number;
}

/**
 * 按父骨骼优先顺序把局部 Pose 展开为世界空间矩阵。
 *
 * 求值器持有并复用世界四元数缓存，高频路径不会逐帧创建对象或数组。
 */
export class VanguardForwardKinematics {
  private readonly worldRotations = new Float64Array(
    VanguardBone.Count * VANGUARD_QUATERNION_COMPONENTS,
  );
  private readonly headingRotation = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);

  /** 将一个实体的局部姿态写成 CPU 蒙皮与挂点共同使用的世界骨骼矩阵。 */
  public writeWorldPose(
    localPositions: Float32Array | Float64Array,
    localRotations: Float32Array | Float64Array,
    matrices: VanguardBoneMatrixArray,
    entityIndex: number,
    transform: Readonly<VanguardRigTransform>,
  ): void {
    validateTransform(transform);
    const positionEntityOffset = entityIndex
      * VanguardBone.Count
      * VANGUARD_LOCAL_POSITION_COMPONENTS;
    const rotationEntityOffset = entityIndex
      * VanguardBone.Count
      * VANGUARD_QUATERNION_COMPONENTS;
    const matrixEntityOffset = entityIndex
      * VanguardBone.Count
      * VANGUARD_BONE_MATRIX_COMPONENTS;
    writeAxisAngleQuaternion(this.headingRotation, 0, 0, 1, 0, transform.heading);

    for (let bone = 0; bone < VanguardBone.Count; bone++) {
      const localPositionOffset = positionEntityOffset
        + bone * VANGUARD_LOCAL_POSITION_COMPONENTS;
      const localRotationOffset = rotationEntityOffset
        + bone * VANGUARD_QUATERNION_COMPONENTS;
      const worldRotationOffset = bone * VANGUARD_QUATERNION_COMPONENTS;
      const matrixOffset = matrixEntityOffset
        + bone * VANGUARD_BONE_MATRIX_COMPONENTS;
      const parent = VANGUARD_BONE_PARENTS[bone] ?? -1;
      if (parent < 0) {
        this.writeRoot(
          localPositions,
          localPositionOffset,
          localRotations,
          localRotationOffset,
          matrices,
          matrixOffset,
          worldRotationOffset,
          transform,
        );
        continue;
      }
      const parentWorldRotationOffset = parent * VANGUARD_QUATERNION_COMPONENTS;
      multiplyQuaternionComponents(
        this.worldRotations,
        worldRotationOffset,
        this.worldRotations[parentWorldRotationOffset] ?? 0,
        this.worldRotations[parentWorldRotationOffset + 1] ?? 0,
        this.worldRotations[parentWorldRotationOffset + 2] ?? 0,
        this.worldRotations[parentWorldRotationOffset + 3] ?? 1,
        localRotations[localRotationOffset] ?? 0,
        localRotations[localRotationOffset + 1] ?? 0,
        localRotations[localRotationOffset + 2] ?? 0,
        localRotations[localRotationOffset + 3] ?? 1,
      );
      const parentMatrixOffset = matrixEntityOffset
        + parent * VANGUARD_BONE_MATRIX_COMPONENTS;
      const localX = localPositions[localPositionOffset] ?? 0;
      const localY = localPositions[localPositionOffset + 1] ?? 0;
      const localZ = localPositions[localPositionOffset + 2] ?? 0;
      writeAffineMatrix(
        matrices,
        matrixOffset,
        this.worldRotations,
        worldRotationOffset,
        (matrices[parentMatrixOffset + 9] ?? 0)
          + (matrices[parentMatrixOffset] ?? 0) * localX
          + (matrices[parentMatrixOffset + 3] ?? 0) * localY
          + (matrices[parentMatrixOffset + 6] ?? 0) * localZ,
        (matrices[parentMatrixOffset + 10] ?? 0)
          + (matrices[parentMatrixOffset + 1] ?? 0) * localX
          + (matrices[parentMatrixOffset + 4] ?? 0) * localY
          + (matrices[parentMatrixOffset + 7] ?? 0) * localZ,
        (matrices[parentMatrixOffset + 11] ?? 0)
          + (matrices[parentMatrixOffset + 2] ?? 0) * localX
          + (matrices[parentMatrixOffset + 5] ?? 0) * localY
          + (matrices[parentMatrixOffset + 8] ?? 0) * localZ,
        transform.scale,
      );
    }
  }

  private writeRoot(
    localPositions: Float32Array | Float64Array,
    localPositionOffset: number,
    localRotations: Float32Array | Float64Array,
    localRotationOffset: number,
    matrices: VanguardBoneMatrixArray,
    matrixOffset: number,
    worldRotationOffset: number,
    transform: Readonly<VanguardRigTransform>,
  ): void {
    multiplyQuaternionComponents(
      this.worldRotations,
      worldRotationOffset,
      this.headingRotation[0] ?? 0,
      this.headingRotation[1] ?? 0,
      this.headingRotation[2] ?? 0,
      this.headingRotation[3] ?? 1,
      localRotations[localRotationOffset] ?? 0,
      localRotations[localRotationOffset + 1] ?? 0,
      localRotations[localRotationOffset + 2] ?? 0,
      localRotations[localRotationOffset + 3] ?? 1,
    );
    const localX = localPositions[localPositionOffset] ?? 0;
    const localY = localPositions[localPositionOffset + 1] ?? 0;
    const localZ = localPositions[localPositionOffset + 2] ?? 0;
    const headingCosine = Math.cos(transform.heading);
    const headingSine = Math.sin(transform.heading);
    writeAffineMatrix(
      matrices,
      matrixOffset,
      this.worldRotations,
      worldRotationOffset,
      transform.positionX
        + (localX * headingCosine + localZ * headingSine) * transform.scale,
      transform.positionY + localY * transform.scale,
      transform.positionZ
        + (-localX * headingSine + localZ * headingCosine) * transform.scale,
      transform.scale,
    );
  }
}

function validateTransform(transform: Readonly<VanguardRigTransform>): void {
  if (!Number.isFinite(transform.positionX)
    || !Number.isFinite(transform.positionY)
    || !Number.isFinite(transform.positionZ)
    || !Number.isFinite(transform.heading)
    || !Number.isFinite(transform.scale)
    || transform.scale <= 0) {
    throw new Error('主角 FK 根变换必须由有限位置、朝向和正缩放组成。');
  }
}
