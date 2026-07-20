import { lerp } from '../../../core/math/scalar';
import { VANGUARD_ANATOMY } from '../model/vanguard-anatomy';
import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
  type VanguardBoneMatrixArray,
} from '../model/vanguard-bone';
import { writeSegmentFrame, writeYawRollFrame } from './vanguard-pose-frame';
import { VANGUARD_WEAPON_STANCE } from './vanguard-weapon-stance';

/** 创建供程序化人体拓扑预计算绑定坐标使用的中立骨骼矩阵。 */
export function createVanguardBindPoseMatrices(): Float64Array {
  const matrices = new Float64Array(
    VanguardBone.Count * VANGUARD_BONE_MATRIX_COMPONENTS,
  );
  writeVanguardPoseMatrices(matrices, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0);
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
 * @param weaponStanceBlend 自然摆臂与双手持枪姿势的混合权重。
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
  weaponStanceBlend: number,
): void {
  const entityOffset = entityIndex
    * VanguardBone.Count
    * VANGUARD_BONE_MATRIX_COMPONENTS;
  const locomotion = Math.max(0, Math.min(1, locomotionBlend));
  const weaponStance = Math.max(0, Math.min(1, weaponStanceBlend));
  const strideWave = Math.sin(locomotionPhase);
  const bodyBob = Math.abs(strideWave) * 0.045 * locomotion;
  const leftStepLift = Math.max(0, strideWave) * 0.15 * locomotion;
  const rightStepLift = Math.max(0, -strideWave) * 0.15 * locomotion;
  const stride = strideWave * 0.46 * locomotion;
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
    0.012,
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
    0.018,
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
    0.018,
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
  const leftArmSwing = -stride * 0.62;
  const rightArmSwing = stride * 0.62;
  const stance = VANGUARD_WEAPON_STANCE;
  const leftElbowX = lerp(
    VANGUARD_ANATOMY.leftElbowX + sway * 0.06,
    stance.leftElbow.x,
    weaponStance,
  );
  const leftElbowY = lerp(
    VANGUARD_ANATOMY.leftElbowY + leftShoulderLift * 0.45,
    shoulderY - stance.leftElbow.shoulderDrop,
    weaponStance,
  );
  const leftElbowZ = lerp(
    0.025 + leftArmSwing * 0.45,
    stance.leftElbow.z,
    weaponStance,
  );
  const leftWristX = lerp(
    VANGUARD_ANATOMY.leftWristX - armRelax,
    stance.leftWrist.x,
    weaponStance,
  );
  const leftWristY = lerp(
    VANGUARD_ANATOMY.leftWristY + leftShoulderLift * 0.18,
    shoulderY - stance.leftWrist.shoulderDrop,
    weaponStance,
  );
  const leftWristZ = lerp(0.065 + leftArmSwing, stance.leftWrist.z, weaponStance);
  const leftHandX = lerp(
    VANGUARD_ANATOMY.leftHandX - armRelax * 1.2,
    stance.leftHand.x,
    weaponStance,
  );
  const leftHandY = lerp(
    VANGUARD_ANATOMY.leftHandY + leftShoulderLift * 0.1,
    shoulderY - stance.leftHand.shoulderDrop,
    weaponStance,
  );
  const leftHandZ = lerp(
    0.12 + leftArmSwing * 1.08,
    stance.leftHand.z,
    weaponStance,
  );
  const rightElbowX = lerp(
    VANGUARD_ANATOMY.rightElbowX + sway * 0.04,
    stance.rightElbow.x,
    weaponStance,
  );
  const rightElbowY = lerp(
    VANGUARD_ANATOMY.rightElbowY + rightShoulderLift * 0.42,
    shoulderY - stance.rightElbow.shoulderDrop,
    weaponStance,
  );
  const rightElbowZ = lerp(
    0.04 + rightArmSwing * 0.45,
    stance.rightElbow.z,
    weaponStance,
  );
  const rightWristX = lerp(
    VANGUARD_ANATOMY.rightWristX + armRelax,
    stance.rightWrist.x,
    weaponStance,
  );
  const rightWristY = lerp(
    VANGUARD_ANATOMY.rightWristY + rightShoulderLift * 0.18,
    shoulderY - stance.rightWrist.shoulderDrop,
    weaponStance,
  );
  const rightWristZ = lerp(0.09 + rightArmSwing, stance.rightWrist.z, weaponStance);
  const rightHandX = lerp(
    VANGUARD_ANATOMY.rightHandX + armRelax * 1.2,
    stance.rightHand.x,
    weaponStance,
  );
  const rightHandY = lerp(
    VANGUARD_ANATOMY.rightHandY + rightShoulderLift * 0.1,
    shoulderY - stance.rightHand.shoulderDrop,
    weaponStance,
  );
  const rightHandZ = lerp(
    0.14 + rightArmSwing * 1.08,
    stance.rightHand.z,
    weaponStance,
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
  const leftKneeY = VANGUARD_ANATOMY.kneeY + leftStepLift * 0.28;
  const rightKneeY = VANGUARD_ANATOMY.kneeY + 0.015 + rightStepLift * 0.28;
  const leftAnkleY = VANGUARD_ANATOMY.ankleY + leftStepLift;
  const rightAnkleY = VANGUARD_ANATOMY.ankleY + rightStepLift;
  const leftKneeZ = 0.025 + stride * 0.42;
  const rightKneeZ = -0.015 - stride * 0.42;
  const leftFootZ = VANGUARD_ANATOMY.toeForward + stride;
  const rightFootZ = VANGUARD_ANATOMY.toeForward + 0.015 - stride;
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.LeftThigh,
    leftHipX, VANGUARD_ANATOMY.pelvisY + bodyBob, 0,
    -0.35, leftKneeY, leftKneeZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.LeftShin,
    -0.35, leftKneeY, leftKneeZ,
    -0.36, leftAnkleY, stride * 0.82,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.LeftFoot,
    -0.36, leftAnkleY, stride * 0.82,
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
    0.36, rightAnkleY, -stride * 0.82,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.RightFoot,
    0.36, rightAnkleY, -stride * 0.82,
    0.36, VANGUARD_ANATOMY.toeY + rightStepLift, rightFootZ,
    positionX, positionY, positionZ, heading, scale,
  );

}
