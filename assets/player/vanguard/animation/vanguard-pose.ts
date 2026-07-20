import { lerp } from '../../../core/math/scalar';
import { VANGUARD_ANATOMY } from '../model/vanguard-anatomy';
import { VanguardWeaponPose } from '../model/vanguard-weapon-pose';
import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
  type VanguardBoneMatrixArray,
} from '../model/vanguard-bone';
import { writeSegmentFrame, writeYawRollFrame } from './vanguard-pose-frame';
import { getVanguardWeaponStance } from './vanguard-weapon-stance';

/** 创建供程序化人体拓扑预计算绑定坐标使用的中立骨骼矩阵。 */
export function createVanguardBindPoseMatrices(): Float64Array {
  const matrices = new Float64Array(
    VanguardBone.Count * VANGUARD_BONE_MATRIX_COMPONENTS,
  );
  writeVanguardPoseMatrices(
    matrices,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    VanguardWeaponPose.Unarmed,
    0,
    0,
  );
  return matrices;
}

/**
 * 写入单个主角当前世界空间骨骼矩阵。
 *
 * @param matrices 连续骨骼矩阵数组。
 * @param entityIndex 实体索引。
 * @param positionX 角色根节点世界 X。
 * @param positionY 角色脚底世界 Y。
 * @param positionZ 角色根节点世界 Z。
 * @param heading 绕世界 Y 轴的角色朝向。
 * @param scale 角色统一缩放。
 * @param phase 当前待机循环相位。
 * @param locomotionPhase 按真实移动距离推进的步态相位。
 * @param locomotionBlend 待机与移动姿态的混合权重。
 * @param weaponPose 当前武器对应的类型化上身姿态。
 * @param weaponStanceBlend 自然摆臂与武器姿势的混合权重。
 * @param weaponAttackAmount 最近一次攻击留下的姿态脉冲。
 */
export function writeVanguardPoseMatrices(
  matrices: VanguardBoneMatrixArray,
  entityIndex: number,
  positionX: number,
  positionY: number,
  positionZ: number,
  heading: number,
  scale: number,
  phase: number,
  locomotionPhase: number,
  locomotionBlend: number,
  weaponPose: VanguardWeaponPose,
  weaponStanceBlend: number,
  weaponAttackAmount: number,
): void {
  const entityOffset = entityIndex
    * VanguardBone.Count
    * VANGUARD_BONE_MATRIX_COMPONENTS;
  const locomotion = Math.max(0, Math.min(1, locomotionBlend));
  const weaponStance = Math.max(0, Math.min(1, weaponStanceBlend));
  const rawAttackAmount = Math.max(0, Math.min(1, weaponAttackAmount));
  const attackAmount = rawAttackAmount * rawAttackAmount * (3 - rawAttackAmount * 2);
  const strideWave = Math.sin(locomotionPhase);
  const bodyBob = Math.abs(Math.cos(locomotionPhase)) * 0.065 * locomotion;
  const leftStepLift = Math.max(0, strideWave) * 0.36 * locomotion;
  const rightStepLift = Math.max(0, -strideWave) * 0.36 * locomotion;
  const stride = strideWave * 0.72 * locomotion;
  const idleWeight = 1 - locomotion * 0.72;
  const breath = Math.sin(phase * 2) * 0.018 * idleWeight;
  const sway = Math.sin(phase) * 0.018 * idleWeight
    + Math.cos(locomotionPhase) * 0.025 * locomotion;
  const shrugWave = Math.max(0, -Math.sin(phase));
  const shoulderLift = shrugWave * shrugWave * shrugWave * shrugWave * 0.035 * idleWeight;
  const headYaw = (Math.sin(phase) * 0.16 + Math.sin(phase * 2) * 0.025) * idleWeight;
  const armRelax = Math.sin(phase * 2) * 0.008 * idleWeight;

  writeYawRollFrame(
    matrices,
    entityOffset,
    VanguardBone.Root,
    0,
    0,
    0,
    0,
    0,
    positionX,
    positionY,
    positionZ,
    heading,
    scale,
  );
  writeYawRollFrame(
    matrices,
    entityOffset,
    VanguardBone.Pelvis,
    sway,
    VANGUARD_ANATOMY.pelvisY + bodyBob,
    0,
    0,
    -sway * 0.5,
    positionX,
    positionY,
    positionZ,
    heading,
    scale,
  );
  writeYawRollFrame(
    matrices,
    entityOffset,
    VanguardBone.Chest,
    sway * 0.35,
    VANGUARD_ANATOMY.chestY + breath + bodyBob,
    0.012 + locomotion * 0.1,
    0,
    sway * 0.42,
    positionX,
    positionY,
    positionZ,
    heading,
    scale,
  );
  writeYawRollFrame(
    matrices,
    entityOffset,
    VanguardBone.Neck,
    sway * 0.18,
    VANGUARD_ANATOMY.neckY + breath * 0.75 + bodyBob,
    0.018 + locomotion * 0.075,
    headYaw * 0.46,
    0,
    positionX,
    positionY,
    positionZ,
    heading,
    scale,
  );
  writeYawRollFrame(
    matrices,
    entityOffset,
    VanguardBone.Head,
    sway * 0.12,
    VANGUARD_ANATOMY.headPivotY + breath * 0.7 + bodyBob,
    0.018 + locomotion * 0.055,
    headYaw,
    -sway * 0.15,
    positionX,
    positionY,
    positionZ,
    heading,
    scale,
  );

  const leftShoulderX = -VANGUARD_ANATOMY.shoulderHalfWidth + sway * 0.08;
  const rightShoulderX = VANGUARD_ANATOMY.shoulderHalfWidth + sway * 0.08;
  const shoulderY = VANGUARD_ANATOMY.shoulderY + breath * 0.55 + bodyBob;
  const leftShoulderLift = shoulderLift * 0.9;
  const rightShoulderLift = shoulderLift;
  const leftArmSwing = -stride * 0.78;
  const rightArmSwing = stride * 0.78;
  const stance = getVanguardWeaponStance(weaponPose);
  const leftWeaponStance = weaponStance * stance.leftInfluence;
  const rightWeaponStance = weaponStance * stance.rightInfluence;
  const leftElbowX = lerp(
    VANGUARD_ANATOMY.leftElbowX + sway * 0.06,
    stance.leftElbow.x + stance.leftElbow.attackX * attackAmount,
    leftWeaponStance,
  );
  const leftElbowY = lerp(
    lerp(VANGUARD_ANATOMY.leftElbowY, 2.28, locomotion)
      + leftShoulderLift * 0.45,
    shoulderY - stance.leftElbow.shoulderDrop
      - stance.leftElbow.attackShoulderDrop * attackAmount,
    leftWeaponStance,
  );
  const leftElbowZ = lerp(
    0.12 + leftArmSwing * 0.28,
    stance.leftElbow.z + stance.leftElbow.attackZ * attackAmount,
    leftWeaponStance,
  );
  const leftWristX = lerp(
    VANGUARD_ANATOMY.leftWristX - armRelax,
    stance.leftWrist.x + stance.leftWrist.attackX * attackAmount,
    leftWeaponStance,
  );
  const leftWristY = lerp(
    lerp(VANGUARD_ANATOMY.leftWristY, 1.98, locomotion)
      + leftShoulderLift * 0.18,
    shoulderY - stance.leftWrist.shoulderDrop
      - stance.leftWrist.attackShoulderDrop * attackAmount,
    leftWeaponStance,
  );
  const leftWristZ = lerp(
    0.12 + leftArmSwing * 0.86,
    stance.leftWrist.z + stance.leftWrist.attackZ * attackAmount,
    leftWeaponStance,
  );
  const leftHandX = lerp(
    VANGUARD_ANATOMY.leftHandX - armRelax * 1.2,
    stance.leftHand.x + stance.leftHand.attackX * attackAmount,
    leftWeaponStance,
  );
  const leftHandY = lerp(
    lerp(VANGUARD_ANATOMY.leftHandY, 1.8, locomotion)
      + leftShoulderLift * 0.1,
    shoulderY - stance.leftHand.shoulderDrop
      - stance.leftHand.attackShoulderDrop * attackAmount,
    leftWeaponStance,
  );
  const leftHandZ = lerp(
    0.18 + leftArmSwing,
    stance.leftHand.z + stance.leftHand.attackZ * attackAmount,
    leftWeaponStance,
  );
  const rightElbowX = lerp(
    VANGUARD_ANATOMY.rightElbowX + sway * 0.04,
    stance.rightElbow.x + stance.rightElbow.attackX * attackAmount,
    rightWeaponStance,
  );
  const rightElbowY = lerp(
    lerp(VANGUARD_ANATOMY.rightElbowY, 2.3, locomotion)
      + rightShoulderLift * 0.42,
    shoulderY - stance.rightElbow.shoulderDrop
      - stance.rightElbow.attackShoulderDrop * attackAmount,
    rightWeaponStance,
  );
  const rightElbowZ = lerp(
    0.13 + rightArmSwing * 0.28,
    stance.rightElbow.z + stance.rightElbow.attackZ * attackAmount,
    rightWeaponStance,
  );
  const rightWristX = lerp(
    VANGUARD_ANATOMY.rightWristX + armRelax,
    stance.rightWrist.x + stance.rightWrist.attackX * attackAmount,
    rightWeaponStance,
  );
  const rightWristY = lerp(
    lerp(VANGUARD_ANATOMY.rightWristY, 2, locomotion)
      + rightShoulderLift * 0.18,
    shoulderY - stance.rightWrist.shoulderDrop
      - stance.rightWrist.attackShoulderDrop * attackAmount,
    rightWeaponStance,
  );
  const rightWristZ = lerp(
    0.14 + rightArmSwing * 0.86,
    stance.rightWrist.z + stance.rightWrist.attackZ * attackAmount,
    rightWeaponStance,
  );
  const rightHandX = lerp(
    VANGUARD_ANATOMY.rightHandX + armRelax * 1.2,
    stance.rightHand.x + stance.rightHand.attackX * attackAmount,
    rightWeaponStance,
  );
  const rightHandY = lerp(
    lerp(VANGUARD_ANATOMY.rightHandY, 1.82, locomotion)
      + rightShoulderLift * 0.1,
    shoulderY - stance.rightHand.shoulderDrop
      - stance.rightHand.attackShoulderDrop * attackAmount,
    rightWeaponStance,
  );
  const rightHandZ = lerp(
    0.2 + rightArmSwing,
    stance.rightHand.z + stance.rightHand.attackZ * attackAmount,
    rightWeaponStance,
  );

  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.LeftUpperArm,
    leftShoulderX, shoulderY + leftShoulderLift, 0,
    leftElbowX, leftElbowY, leftElbowZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.LeftForearm,
    leftElbowX, leftElbowY, leftElbowZ,
    leftWristX, leftWristY, leftWristZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.LeftHand,
    leftWristX, leftWristY, leftWristZ,
    leftHandX, leftHandY, leftHandZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.RightUpperArm,
    rightShoulderX, shoulderY + rightShoulderLift, 0.008,
    rightElbowX, rightElbowY, rightElbowZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.RightForearm,
    rightElbowX, rightElbowY, rightElbowZ,
    rightWristX, rightWristY, rightWristZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.RightHand,
    rightWristX, rightWristY, rightWristZ,
    rightHandX, rightHandY, rightHandZ,
    positionX, positionY, positionZ, heading, scale,
  );

  const leftHipX = -VANGUARD_ANATOMY.hipHalfWidth + sway * 0.75;
  const rightHipX = VANGUARD_ANATOMY.hipHalfWidth + sway * 0.75;
  const leftKneeY = VANGUARD_ANATOMY.kneeY
    + leftStepLift * 0.58
    + Math.max(0, -strideWave) * 0.07 * locomotion;
  const rightKneeY = VANGUARD_ANATOMY.kneeY + 0.015
    + rightStepLift * 0.58
    + Math.max(0, strideWave) * 0.07 * locomotion;
  const leftAnkleY = VANGUARD_ANATOMY.ankleY + leftStepLift;
  const rightAnkleY = VANGUARD_ANATOMY.ankleY + rightStepLift;
  const leftKneeZ = 0.025 + locomotion * 0.2 + stride * 0.58;
  const rightKneeZ = -0.015 + locomotion * 0.2 - stride * 0.58;
  const leftAnkleZ = stride * 0.93;
  const rightAnkleZ = -stride * 0.93;
  const leftFootZ = VANGUARD_ANATOMY.toeForward + stride * 1.12;
  const rightFootZ = VANGUARD_ANATOMY.toeForward + 0.015 - stride * 1.12;
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.LeftThigh,
    leftHipX, VANGUARD_ANATOMY.pelvisY + bodyBob, 0,
    -0.35, leftKneeY, leftKneeZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.LeftShin,
    -0.35, leftKneeY, leftKneeZ,
    -0.36, leftAnkleY, leftAnkleZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.LeftFoot,
    -0.36, leftAnkleY, leftAnkleZ,
    -0.36, VANGUARD_ANATOMY.toeY + leftStepLift, leftFootZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.RightThigh,
    rightHipX, VANGUARD_ANATOMY.pelvisY + bodyBob, 0,
    0.35, rightKneeY, rightKneeZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.RightShin,
    0.35, rightKneeY, rightKneeZ,
    0.36, rightAnkleY, rightAnkleZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.RightFoot,
    0.36, rightAnkleY, rightAnkleZ,
    0.36, VANGUARD_ANATOMY.toeY + rightStepLift, rightFootZ,
    positionX, positionY, positionZ, heading, scale,
  );

}
