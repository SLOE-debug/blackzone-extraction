import { VanguardWeaponPose } from '../model/vanguard-weapon-pose';

/** 单个手臂关节相对肩部的基础目标与攻击脉冲偏移。 */
export interface VanguardWeaponStanceJoint {
  readonly x: number;
  readonly shoulderDrop: number;
  readonly z: number;
  readonly attackX: number;
  readonly attackShoulderDrop: number;
  readonly attackZ: number;
}

/** 一种武器姿态对左右手臂的独立约束。 */
export interface VanguardWeaponStance {
  readonly leftInfluence: number;
  readonly rightInfluence: number;
  readonly leftElbow: Readonly<VanguardWeaponStanceJoint>;
  readonly leftWrist: Readonly<VanguardWeaponStanceJoint>;
  readonly leftHand: Readonly<VanguardWeaponStanceJoint>;
  readonly rightElbow: Readonly<VanguardWeaponStanceJoint>;
  readonly rightWrist: Readonly<VanguardWeaponStanceJoint>;
  readonly rightHand: Readonly<VanguardWeaponStanceJoint>;
}

const UNARMED_STANCE = stance(
  0,
  0,
  joint(-0.76, 0.69, 0),
  joint(-0.69, 1.23, 0.04),
  joint(-0.68, 1.45, 0.1),
  joint(0.78, 0.66, 0),
  joint(0.78, 1.19, 0.05),
  joint(0.81, 1.41, 0.11),
);

/** 手枪只约束右臂，左臂继续参与自然跑步摆动。 */
const HANDGUN_STANCE = stance(
  0,
  1,
  joint(-0.76, 0.69, 0),
  joint(-0.69, 1.23, 0.04),
  joint(-0.68, 1.45, 0.1),
  joint(0.5, 0.38, 0.48, 0.01, -0.025, -0.07),
  joint(0.34, 0.47, 0.89, 0.015, -0.02, -0.11),
  joint(0.29, 0.46, 1.12, 0.01, -0.015, -0.14),
);

const VANGUARD_WEAPON_STANCES = Object.freeze({
  [VanguardWeaponPose.Unarmed]: UNARMED_STANCE,
  [VanguardWeaponPose.Handgun]: HANDGUN_STANCE,
} satisfies Readonly<Record<VanguardWeaponPose, Readonly<VanguardWeaponStance>>>);

/** 返回主角动画系统登记的完整武器姿态。 */
export function getVanguardWeaponStance(
  weaponPose: VanguardWeaponPose,
): Readonly<VanguardWeaponStance> {
  return VANGUARD_WEAPON_STANCES[weaponPose];
}

function stance(
  leftInfluence: number,
  rightInfluence: number,
  leftElbow: Readonly<VanguardWeaponStanceJoint>,
  leftWrist: Readonly<VanguardWeaponStanceJoint>,
  leftHand: Readonly<VanguardWeaponStanceJoint>,
  rightElbow: Readonly<VanguardWeaponStanceJoint>,
  rightWrist: Readonly<VanguardWeaponStanceJoint>,
  rightHand: Readonly<VanguardWeaponStanceJoint>,
): Readonly<VanguardWeaponStance> {
  return Object.freeze({
    leftInfluence,
    rightInfluence,
    leftElbow,
    leftWrist,
    leftHand,
    rightElbow,
    rightWrist,
    rightHand,
  });
}

function joint(
  x: number,
  shoulderDrop: number,
  z: number,
  attackX = 0,
  attackShoulderDrop = 0,
  attackZ = 0,
): Readonly<VanguardWeaponStanceJoint> {
  return Object.freeze({ x, shoulderDrop, z, attackX, attackShoulderDrop, attackZ });
}
