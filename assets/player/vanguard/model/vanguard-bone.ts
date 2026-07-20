/** 主角连续人体网格使用的骨骼。 */
export enum VanguardBone {
  Root,
  VisualRoot,
  Pelvis,
  SpineLower,
  Chest,
  Neck,
  Head,
  LeftClavicle,
  LeftUpperArm,
  LeftForearm,
  LeftHand,
  RightClavicle,
  RightUpperArm,
  RightForearm,
  RightHand,
  LeftThigh,
  LeftShin,
  LeftFoot,
  LeftToe,
  RightThigh,
  RightShin,
  RightFoot,
  RightToe,
  WeaponAimRoot,
  Count,
}

/** 单个骨骼仿射矩阵使用三组基向量和一个平移，共十二个连续分量。 */
export const VANGUARD_BONE_MATRIX_COMPONENTS = 12;

/** 几何与动画共同接受的骨骼矩阵数组。 */
export type VanguardBoneMatrixArray = Float32Array | Float64Array;
