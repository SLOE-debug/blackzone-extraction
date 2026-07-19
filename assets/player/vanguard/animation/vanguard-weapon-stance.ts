export interface VanguardWeaponStanceJoint {
  readonly x: number;
  readonly shoulderDrop: number;
  readonly z: number;
}

/** 角色局部空间中的双手持枪关节目标，纵向值使用相对肩部的向下距离。 */
export const VANGUARD_WEAPON_STANCE = Object.freeze({
  leftElbow: joint(-0.43, 0.34, 0.48),
  leftWrist: joint(0.02, 0.47, 0.84),
  leftHand: joint(0.15, 0.48, 1.03),
  rightElbow: joint(0.46, 0.31, 0.53),
  rightWrist: joint(0.24, 0.43, 0.91),
  rightHand: joint(0.19, 0.45, 1.17),
});

function joint(
  x: number,
  shoulderDrop: number,
  z: number,
): Readonly<VanguardWeaponStanceJoint> {
  return Object.freeze({ x, shoulderDrop, z });
}
