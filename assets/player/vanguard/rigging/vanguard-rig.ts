import { VANGUARD_ANATOMY } from '../model/vanguard-anatomy';
import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
} from '../model/vanguard-bone';
import {
  invertQuaternion,
  multiplyQuaternions,
  rotateVectorByQuaternion,
  VANGUARD_QUATERNION_COMPONENTS,
  writeIdentityQuaternion,
  writeSegmentQuaternion,
} from './vanguard-pose-math';
import { writeAffineMatrix } from './vanguard-affine-matrix';

export const VANGUARD_LOCAL_POSITION_COMPONENTS = 3;

/** 单个关节允许的局部摆动与绕骨轴扭转范围。 */
export interface VanguardJointLimit {
  readonly maximumSwing: number;
  readonly minimumTwist: number;
  readonly maximumTwist: number;
}

/**
 * 主角标准骨架的父子表。
 *
 * 索引与 {@link VanguardBone} 完全一致，且父骨骼始终先于子骨骼，便于连续 FK 求值。
 */
export const VANGUARD_BONE_PARENTS: Readonly<Int8Array> = new Int8Array([
  -1,
  VanguardBone.Root,
  VanguardBone.VisualRoot,
  VanguardBone.Pelvis,
  VanguardBone.SpineLower,
  VanguardBone.Chest,
  VanguardBone.Neck,
  VanguardBone.Chest,
  VanguardBone.LeftClavicle,
  VanguardBone.LeftUpperArm,
  VanguardBone.LeftForearm,
  VanguardBone.Chest,
  VanguardBone.RightClavicle,
  VanguardBone.RightUpperArm,
  VanguardBone.RightForearm,
  VanguardBone.Pelvis,
  VanguardBone.LeftThigh,
  VanguardBone.LeftShin,
  VanguardBone.LeftFoot,
  VanguardBone.Pelvis,
  VanguardBone.RightThigh,
  VanguardBone.RightShin,
  VanguardBone.RightFoot,
  VanguardBone.VisualRoot,
]);

/** 供约束系统使用的类型化关节活动范围。 */
export const VANGUARD_JOINT_LIMITS: readonly VanguardJointLimit[] = Object.freeze([
  limit(Math.PI, -Math.PI, Math.PI),
  limit(0.5, -0.35, 0.35),
  limit(0.42, -0.3, 0.3),
  limit(0.38, -0.24, 0.24),
  limit(0.52, -0.38, 0.38),
  limit(0.65, -0.55, 0.55),
  limit(0.78, -0.7, 0.7),
  limit(0.62, -0.55, 0.55),
  limit(2.45, -1.7, 1.7),
  limit(2.65, -1.2, 1.2),
  limit(0.9, -0.85, 0.85),
  limit(0.62, -0.55, 0.55),
  limit(2.45, -1.7, 1.7),
  limit(2.65, -1.2, 1.2),
  limit(0.9, -0.85, 0.85),
  limit(1.78, -1.05, 1.05),
  limit(2.7, -0.35, 0.35),
  limit(1.05, -0.55, 0.55),
  limit(0.72, -0.35, 0.35),
  limit(1.78, -1.05, 1.05),
  limit(2.7, -0.35, 0.35),
  limit(1.05, -0.55, 0.55),
  limit(0.72, -0.35, 0.35),
  limit(1.2, -1.2, 1.2),
]);

interface VanguardBindRig {
  readonly localPositions: Float64Array;
  readonly localRotations: Float64Array;
  readonly worldMatrices: Float64Array;
  readonly inverseWorldMatrices: Float64Array;
}

const BIND_RIG = createVanguardBindRig();

/** 标准绑定姿态中每根骨骼相对父骨骼的局部位移。 */
export const VANGUARD_BIND_LOCAL_POSITIONS: Readonly<Float64Array> =
  BIND_RIG.localPositions;

/** 标准绑定姿态中每根骨骼相对父骨骼的局部旋转。 */
export const VANGUARD_BIND_LOCAL_ROTATIONS: Readonly<Float64Array> =
  BIND_RIG.localRotations;

/** 标准绑定姿态的模型空间骨骼矩阵，供程序化网格建立蒙皮局部坐标。 */
export const VANGUARD_BIND_WORLD_MATRICES: Readonly<Float64Array> =
  BIND_RIG.worldMatrices;

/** 标准绑定姿态的逆矩阵；当前 CPU 蒙皮与后续 GPU 蒙皮共享同一契约。 */
export const VANGUARD_INVERSE_BIND_MATRICES: Readonly<Float64Array> =
  BIND_RIG.inverseWorldMatrices;

/** 把标准绑定局部姿态复制到一个实体的连续 Pose 存储中。 */
export function writeVanguardBindLocalPose(
  localPositions: Float32Array | Float64Array,
  localRotations: Float32Array | Float64Array,
  entityIndex: number,
): void {
  const positionOffset = entityIndex
    * VanguardBone.Count
    * VANGUARD_LOCAL_POSITION_COMPONENTS;
  const rotationOffset = entityIndex
    * VanguardBone.Count
    * VANGUARD_QUATERNION_COMPONENTS;
  for (let component = 0; component < VANGUARD_BIND_LOCAL_POSITIONS.length; component++) {
    localPositions[positionOffset + component] = VANGUARD_BIND_LOCAL_POSITIONS[component] ?? 0;
  }
  for (let component = 0; component < VANGUARD_BIND_LOCAL_ROTATIONS.length; component++) {
    localRotations[rotationOffset + component] = VANGUARD_BIND_LOCAL_ROTATIONS[component] ?? 0;
  }
}

/** 根据中立人体关键点建立模型空间绑定骨架，再转换为标准局部 Pose。 */
function createVanguardBindRig(): VanguardBindRig {
  validateHierarchy();
  const worldPositions = new Float64Array(
    VanguardBone.Count * VANGUARD_LOCAL_POSITION_COMPONENTS,
  );
  const worldRotations = new Float64Array(
    VanguardBone.Count * VANGUARD_QUATERNION_COMPONENTS,
  );
  for (let bone = 0; bone < VanguardBone.Count; bone++) {
    writeIdentityQuaternion(
      worldRotations,
      bone * VANGUARD_QUATERNION_COMPONENTS,
    );
  }

  writeBonePosition(worldPositions, VanguardBone.Root, 0, 0, 0);
  writeBonePosition(worldPositions, VanguardBone.VisualRoot, 0, 0, 0);
  writeBonePosition(worldPositions, VanguardBone.Pelvis, 0, VANGUARD_ANATOMY.pelvisY, 0);
  writeBonePosition(worldPositions, VanguardBone.SpineLower, 0, 2.02, 0.008);
  writeBonePosition(worldPositions, VanguardBone.Chest, 0, VANGUARD_ANATOMY.chestY, 0.02);
  writeBonePosition(worldPositions, VanguardBone.Neck, 0, VANGUARD_ANATOMY.neckY, 0.018);
  writeBonePosition(worldPositions, VanguardBone.Head, 0, VANGUARD_ANATOMY.headPivotY, 0.018);

  writeSegmentBone(
    worldPositions,
    worldRotations,
    VanguardBone.LeftClavicle,
    -0.18,
    2.67,
    0.018,
    -VANGUARD_ANATOMY.shoulderHalfWidth,
    VANGUARD_ANATOMY.shoulderY,
    0,
  );
  writeArmBind(worldPositions, worldRotations, true);
  writeSegmentBone(
    worldPositions,
    worldRotations,
    VanguardBone.RightClavicle,
    0.18,
    2.67,
    0.018,
    VANGUARD_ANATOMY.shoulderHalfWidth,
    VANGUARD_ANATOMY.shoulderY,
    0.008,
  );
  writeArmBind(worldPositions, worldRotations, false);
  writeLegBind(worldPositions, worldRotations, true);
  writeLegBind(worldPositions, worldRotations, false);
  writeBonePosition(worldPositions, VanguardBone.WeaponAimRoot, 0, 2.54, 0.72);

  const localPositions = new Float64Array(worldPositions.length);
  const localRotations = new Float64Array(worldRotations.length);
  writeLocalBindPose(worldPositions, worldRotations, localPositions, localRotations);
  const worldMatrices = new Float64Array(
    VanguardBone.Count * VANGUARD_BONE_MATRIX_COMPONENTS,
  );
  for (let bone = 0; bone < VanguardBone.Count; bone++) {
    const positionOffset = bone * VANGUARD_LOCAL_POSITION_COMPONENTS;
    const rotationOffset = bone * VANGUARD_QUATERNION_COMPONENTS;
    writeAffineMatrix(
      worldMatrices,
      bone * VANGUARD_BONE_MATRIX_COMPONENTS,
      worldRotations,
      rotationOffset,
      worldPositions[positionOffset] ?? 0,
      worldPositions[positionOffset + 1] ?? 0,
      worldPositions[positionOffset + 2] ?? 0,
      1,
    );
  }
  return {
    localPositions,
    localRotations,
    worldMatrices,
    inverseWorldMatrices: createInverseBindMatrices(worldMatrices),
  };
}

/** 绑定矩阵仅包含刚体变换，直接以转置旋转和负投影平移构造其逆。 */
function createInverseBindMatrices(worldMatrices: Float64Array): Float64Array {
  const inverseMatrices = new Float64Array(worldMatrices.length);
  for (let bone = 0; bone < VanguardBone.Count; bone++) {
    const offset = bone * VANGUARD_BONE_MATRIX_COMPONENTS;
    const positionX = worldMatrices[offset + 9] ?? 0;
    const positionY = worldMatrices[offset + 10] ?? 0;
    const positionZ = worldMatrices[offset + 11] ?? 0;
    inverseMatrices[offset] = worldMatrices[offset] ?? 1;
    inverseMatrices[offset + 1] = worldMatrices[offset + 3] ?? 0;
    inverseMatrices[offset + 2] = worldMatrices[offset + 6] ?? 0;
    inverseMatrices[offset + 3] = worldMatrices[offset + 1] ?? 0;
    inverseMatrices[offset + 4] = worldMatrices[offset + 4] ?? 1;
    inverseMatrices[offset + 5] = worldMatrices[offset + 7] ?? 0;
    inverseMatrices[offset + 6] = worldMatrices[offset + 2] ?? 0;
    inverseMatrices[offset + 7] = worldMatrices[offset + 5] ?? 0;
    inverseMatrices[offset + 8] = worldMatrices[offset + 8] ?? 1;
    inverseMatrices[offset + 9] = -(
      (worldMatrices[offset] ?? 1) * positionX
        + (worldMatrices[offset + 1] ?? 0) * positionY
        + (worldMatrices[offset + 2] ?? 0) * positionZ
    );
    inverseMatrices[offset + 10] = -(
      (worldMatrices[offset + 3] ?? 0) * positionX
        + (worldMatrices[offset + 4] ?? 1) * positionY
        + (worldMatrices[offset + 5] ?? 0) * positionZ
    );
    inverseMatrices[offset + 11] = -(
      (worldMatrices[offset + 6] ?? 0) * positionX
        + (worldMatrices[offset + 7] ?? 0) * positionY
        + (worldMatrices[offset + 8] ?? 1) * positionZ
    );
  }
  return inverseMatrices;
}

/** 写入左右镜像但保留自然肘屈曲的手臂绑定链。 */
function writeArmBind(
  positions: Float64Array,
  rotations: Float64Array,
  left: boolean,
): void {
  const side = left ? -1 : 1;
  const upperArm = left ? VanguardBone.LeftUpperArm : VanguardBone.RightUpperArm;
  const forearm = left ? VanguardBone.LeftForearm : VanguardBone.RightForearm;
  const hand = left ? VanguardBone.LeftHand : VanguardBone.RightHand;
  const shoulderX = side * VANGUARD_ANATOMY.shoulderHalfWidth;
  const shoulderZ = left ? 0 : 0.008;
  const elbowX = side * 0.78;
  const wristX = side * 0.715;
  const handX = side * 0.703;
  writeSegmentBone(
    positions, rotations, upperArm,
    shoulderX, VANGUARD_ANATOMY.shoulderY, shoulderZ,
    elbowX, 2.15, 0,
  );
  writeSegmentBone(
    positions, rotations, forearm,
    elbowX, 2.15, 0,
    wristX, 1.615, 0.07,
  );
  writeSegmentBone(
    positions, rotations, hand,
    wristX, 1.615, 0.07,
    handX, 1.395, 0.108,
  );
}

/** 写入带轻微自然屈膝、脚掌与脚趾分节的腿部绑定链。 */
function writeLegBind(
  positions: Float64Array,
  rotations: Float64Array,
  left: boolean,
): void {
  const side = left ? -1 : 1;
  const thigh = left ? VanguardBone.LeftThigh : VanguardBone.RightThigh;
  const shin = left ? VanguardBone.LeftShin : VanguardBone.RightShin;
  const foot = left ? VanguardBone.LeftFoot : VanguardBone.RightFoot;
  const toe = left ? VanguardBone.LeftToe : VanguardBone.RightToe;
  const x = side * VANGUARD_ANATOMY.hipHalfWidth;
  writeSegmentBone(
    positions, rotations, thigh,
    x, VANGUARD_ANATOMY.pelvisY, 0,
    x, VANGUARD_ANATOMY.kneeY, 0.035,
  );
  writeSegmentBone(
    positions, rotations, shin,
    x, VANGUARD_ANATOMY.kneeY, 0.035,
    x, VANGUARD_ANATOMY.ankleY, -0.02,
  );
  writeSegmentBone(
    positions, rotations, foot,
    x, VANGUARD_ANATOMY.ankleY, -0.02,
    x, 0.095, 0.255,
  );
  writeSegmentBone(
    positions, rotations, toe,
    x, 0.095, 0.255,
    x, VANGUARD_ANATOMY.toeY, VANGUARD_ANATOMY.toeForward,
  );
}

/** 写入骨骼起点并让局部 Y 轴稳定指向子关节。 */
function writeSegmentBone(
  positions: Float64Array,
  rotations: Float64Array,
  bone: VanguardBone,
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
): void {
  writeBonePosition(positions, bone, startX, startY, startZ);
  writeSegmentQuaternion(
    rotations,
    bone * VANGUARD_QUATERNION_COMPONENTS,
    endX - startX,
    endY - startY,
    endZ - startZ,
    0,
    0,
    1,
  );
}

function writeBonePosition(
  positions: Float64Array,
  bone: VanguardBone,
  x: number,
  y: number,
  z: number,
): void {
  const offset = bone * VANGUARD_LOCAL_POSITION_COMPONENTS;
  positions[offset] = x;
  positions[offset + 1] = y;
  positions[offset + 2] = z;
}

/** 把模型空间绑定关节转换为可直接进行父子 FK 的局部变换。 */
function writeLocalBindPose(
  worldPositions: Float64Array,
  worldRotations: Float64Array,
  localPositions: Float64Array,
  localRotations: Float64Array,
): void {
  const inverseParent = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  for (let bone = 0; bone < VanguardBone.Count; bone++) {
    const parent = VANGUARD_BONE_PARENTS[bone] ?? -1;
    const positionOffset = bone * VANGUARD_LOCAL_POSITION_COMPONENTS;
    const rotationOffset = bone * VANGUARD_QUATERNION_COMPONENTS;
    if (parent < 0) {
      localPositions[positionOffset] = worldPositions[positionOffset] ?? 0;
      localPositions[positionOffset + 1] = worldPositions[positionOffset + 1] ?? 0;
      localPositions[positionOffset + 2] = worldPositions[positionOffset + 2] ?? 0;
      for (let component = 0; component < VANGUARD_QUATERNION_COMPONENTS; component++) {
        localRotations[rotationOffset + component] = worldRotations[rotationOffset + component] ?? 0;
      }
      continue;
    }
    const parentPositionOffset = parent * VANGUARD_LOCAL_POSITION_COMPONENTS;
    const parentRotationOffset = parent * VANGUARD_QUATERNION_COMPONENTS;
    invertQuaternion(inverseParent, 0, worldRotations, parentRotationOffset);
    rotateVectorByQuaternion(
      localPositions,
      positionOffset,
      (worldPositions[positionOffset] ?? 0) - (worldPositions[parentPositionOffset] ?? 0),
      (worldPositions[positionOffset + 1] ?? 0)
        - (worldPositions[parentPositionOffset + 1] ?? 0),
      (worldPositions[positionOffset + 2] ?? 0)
        - (worldPositions[parentPositionOffset + 2] ?? 0),
      inverseParent,
      0,
    );
    multiplyQuaternions(
      localRotations,
      rotationOffset,
      inverseParent,
      0,
      worldRotations,
      rotationOffset,
    );
  }
}

function validateHierarchy(): void {
  if (VANGUARD_BONE_PARENTS.length !== VanguardBone.Count) {
    throw new Error('主角骨架父子表长度与骨骼枚举不一致。');
  }
  if (VANGUARD_JOINT_LIMITS.length !== VanguardBone.Count) {
    throw new Error('主角关节限制表长度与骨骼枚举不一致。');
  }
  for (let bone = 0; bone < VanguardBone.Count; bone++) {
    const parent = VANGUARD_BONE_PARENTS[bone] ?? -1;
    if (bone === VanguardBone.Root ? parent !== -1 : parent < 0 || parent >= bone) {
      throw new Error(`主角骨架父子顺序无效：${bone} -> ${parent}`);
    }
  }
}

function limit(
  maximumSwing: number,
  minimumTwist: number,
  maximumTwist: number,
): VanguardJointLimit {
  return Object.freeze({ maximumSwing, minimumTwist, maximumTwist });
}
