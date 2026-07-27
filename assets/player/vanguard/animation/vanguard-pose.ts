import { lerp } from '../../../core/math/scalar';
import { VANGUARD_ANATOMY } from '../model/vanguard-anatomy';
import { VanguardWeaponAction } from '../model/vanguard-weapon-action';
import { VanguardWeaponPose } from '../model/vanguard-weapon-pose';
import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
  type VanguardBoneMatrixArray,
} from '../model/vanguard-bone';
import {
  writeSegmentFrame,
  writeYawRollFrame,
} from './vanguard-pose-frame';
import { writeVanguardWeaponRootFrame } from './vanguard-weapon-root-pose';
import { getVanguardWeaponStance } from './vanguard-weapon-stance';
import {
  type VanguardWeaponAnimationPoseState,
  VANGUARD_WEAPON_ANIMATION_REST_STATE,
} from './vanguard-weapon-animation-state';
import {
  createVanguardTwoHandIkWorkspace,
  writeVanguardTwoHandHeavyPose,
} from './vanguard-two-hand-heavy-pose';
import {
  getVanguardWeaponAttackAmount,
  getVanguardWeaponAttackSide,
} from './vanguard-weapon-action-pose';
import {
  createVanguardTwoHandWeaponTrajectoryPose,
  type VanguardTwoHandWeaponTrajectoryPose,
} from './vanguard-two-hand-weapon-trajectory';
import { writeVanguardLocomotionLegPose } from './vanguard-locomotion-leg-pose';

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
    0,
    0,
    VanguardWeaponPose.Unarmed,
    0,
    VanguardWeaponAction.Idle,
    0,
    0,
    VANGUARD_WEAPON_ANIMATION_REST_STATE,
    createVanguardTwoHandIkWorkspace(),
    createVanguardTwoHandWeaponTrajectoryPose(),
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
 * @param locomotionForward 相对人物朝向的归一化前后移动量。
 * @param locomotionRight 相对人物朝向的归一化左右移动量。
 * @param weaponPose 当前武器对应的类型化上身姿态。
 * @param weaponStanceBlend 自然摆臂与武器姿势的混合权重。
 * @param weaponAction 当前武器动作。
 * @param weaponActionProgress 当前武器动作的归一化进度。
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
  locomotionForward: number,
  locomotionRight: number,
  weaponPose: VanguardWeaponPose,
  weaponStanceBlend: number,
  weaponAction: VanguardWeaponAction,
  weaponActionProgress: number,
  weaponActionSide: -1 | 0 | 1,
  weaponAnimation: Readonly<VanguardWeaponAnimationPoseState>,
  twoHandIkWorkspace: Float64Array,
  weaponTrajectory: Readonly<VanguardTwoHandWeaponTrajectoryPose>,
): void {
  const entityOffset = entityIndex
    * VanguardBone.Count
    * VANGUARD_BONE_MATRIX_COMPONENTS;
  const locomotion = Math.max(0, Math.min(1, locomotionBlend));
  const weaponStance = Math.max(0, Math.min(1, weaponStanceBlend));
  const actionProgress = Math.max(0, Math.min(1, weaponActionProgress));
  const rawAttackAmount = getVanguardWeaponAttackAmount(weaponAction, actionProgress);
  const attackAmount = rawAttackAmount * rawAttackAmount * (3 - rawAttackAmount * 2);
  const attackSide = getVanguardWeaponAttackSide(weaponAction, weaponActionSide);
  const signedAttackAmount = attackAmount * attackSide;
  const weaponBodyYaw = weaponAnimation.chestYaw;
  const weaponPelvisYaw = weaponAnimation.pelvisYaw;
  const strideWave = Math.sin(locomotionPhase);
  const backwardScale = locomotionForward < 0 ? 0.68 : 1;
  const forwardStrideScale = (0.16 + Math.abs(locomotionForward) * 0.84) * backwardScale;
  const stride = strideWave * 0.72 * locomotion * forwardStrideScale;
  const contactCrouch = (weaponAction === VanguardWeaponAction.SwingLeft
    || weaponAction === VanguardWeaponAction.SwingRight
    || weaponAction === VanguardWeaponAction.Spin) ? attackAmount * 0.11 : 0;
  const bodyBob = Math.abs(Math.cos(locomotionPhase)) * 0.065 * locomotion;
  const pelvisBodyBob = bodyBob - contactCrouch;
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
    VANGUARD_ANATOMY.pelvisY + pelvisBodyBob,
    0,
    weaponPelvisYaw,
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
    weaponBodyYaw,
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
    weaponBodyYaw * 0.7 + headYaw * 0.46,
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
    weaponBodyYaw * 0.45 + headYaw,
    -sway * 0.15,
    positionX,
    positionY,
    positionZ,
    heading,
    scale,
  );

  const leftShoulderBaseX = -VANGUARD_ANATOMY.shoulderHalfWidth + sway * 0.08;
  const rightShoulderBaseX = VANGUARD_ANATOMY.shoulderHalfWidth + sway * 0.08;
  const weaponYawCosine = Math.cos(weaponBodyYaw);
  const weaponYawSine = Math.sin(weaponBodyYaw);
  const leftShoulderX = leftShoulderBaseX * weaponYawCosine
    + 0.008 * weaponYawSine;
  const leftShoulderZ = -leftShoulderBaseX * weaponYawSine
    + 0.008 * weaponYawCosine;
  const rightShoulderX = rightShoulderBaseX * weaponYawCosine
    + 0.008 * weaponYawSine;
  const rightShoulderZ = -rightShoulderBaseX * weaponYawSine
    + 0.008 * weaponYawCosine;
  const shoulderY = VANGUARD_ANATOMY.shoulderY + breath * 0.55 + bodyBob;
  const leftShoulderLift = shoulderLift * 0.9;
  const rightShoulderLift = shoulderLift;
  const leftArmSwing = -stride * 0.78;
  const rightArmSwing = stride * 0.78;
  const stance = getVanguardWeaponStance(weaponPose);
  const analyticTwoHand = weaponPose === VanguardWeaponPose.TwoHandHeavy;
  const leftWeaponStance = analyticTwoHand ? 0 : weaponStance * stance.leftInfluence;
  const rightWeaponStance = analyticTwoHand ? 0 : weaponStance * stance.rightInfluence;
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
    stance.rightElbow.x + stance.rightElbow.attackX * signedAttackAmount,
    rightWeaponStance,
  );
  const rightElbowY = lerp(
    lerp(VANGUARD_ANATOMY.rightElbowY, 2.3, locomotion)
      + rightShoulderLift * 0.42,
    shoulderY - stance.rightElbow.shoulderDrop
      - stance.rightElbow.attackShoulderDrop * attackAmount,
    rightWeaponStance,
  );
  const rightElbowBaseZ = lerp(
    0.13 + rightArmSwing * 0.28,
    stance.rightElbow.z + stance.rightElbow.attackZ * attackAmount,
    rightWeaponStance,
  );
  const rightElbowBaseX = rightElbowX;
  const posedRightElbowX = rightElbowBaseX * weaponYawCosine
    + rightElbowBaseZ * weaponYawSine;
  const rightElbowZ = -rightElbowBaseX * weaponYawSine
    + rightElbowBaseZ * weaponYawCosine;
  const rightWristBaseX = lerp(
    VANGUARD_ANATOMY.rightWristX + armRelax,
    stance.rightWrist.x + stance.rightWrist.attackX * signedAttackAmount,
    rightWeaponStance,
  );
  const rightWristY = lerp(
    lerp(VANGUARD_ANATOMY.rightWristY, 2, locomotion)
      + rightShoulderLift * 0.18,
    shoulderY - stance.rightWrist.shoulderDrop
      - stance.rightWrist.attackShoulderDrop * attackAmount,
    rightWeaponStance,
  );
  const rightWristBaseZ = lerp(
    0.14 + rightArmSwing * 0.86,
    stance.rightWrist.z + stance.rightWrist.attackZ * attackAmount,
    rightWeaponStance,
  );
  const rightWristX = rightWristBaseX * weaponYawCosine
    + rightWristBaseZ * weaponYawSine;
  const rightWristZ = -rightWristBaseX * weaponYawSine
    + rightWristBaseZ * weaponYawCosine;
  const rightHandBaseX = lerp(
    VANGUARD_ANATOMY.rightHandX + armRelax * 1.2,
    stance.rightHand.x + stance.rightHand.attackX * signedAttackAmount,
    rightWeaponStance,
  );
  const rightHandY = lerp(
    lerp(VANGUARD_ANATOMY.rightHandY, 1.82, locomotion)
      + rightShoulderLift * 0.1,
    shoulderY - stance.rightHand.shoulderDrop
      - stance.rightHand.attackShoulderDrop * attackAmount,
    rightWeaponStance,
  );
  const rightHandBaseZ = lerp(
    0.2 + rightArmSwing,
    stance.rightHand.z + stance.rightHand.attackZ * attackAmount,
    rightWeaponStance,
  );
  const rightHandX = rightHandBaseX * weaponYawCosine
    + rightHandBaseZ * weaponYawSine;
  const rightHandZ = -rightHandBaseX * weaponYawSine
    + rightHandBaseZ * weaponYawCosine;

  if (analyticTwoHand) {
    writeVanguardTwoHandHeavyPose(
      matrices,
      entityOffset,
      positionX,
      positionY,
      positionZ,
      heading,
      scale,
      weaponStance,
      weaponAnimation,
      weaponTrajectory,
      leftShoulderX,
      shoulderY + leftShoulderLift,
      leftShoulderZ,
      leftWristX,
      leftWristY,
      leftWristZ,
      leftHandX,
      leftHandY,
      leftHandZ,
      rightShoulderX,
      shoulderY + rightShoulderLift,
      rightShoulderZ,
      rightWristX,
      rightWristY,
      rightWristZ,
      rightHandX,
      rightHandY,
      rightHandZ,
      twoHandIkWorkspace,
    );
  } else {
    writeSegmentFrame(
      matrices, entityOffset, VanguardBone.LeftUpperArm,
      leftShoulderX, shoulderY + leftShoulderLift, leftShoulderZ,
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
      rightShoulderX, shoulderY + rightShoulderLift, rightShoulderZ,
      posedRightElbowX, rightElbowY, rightElbowZ,
      positionX, positionY, positionZ, heading, scale,
    );
    writeSegmentFrame(
      matrices, entityOffset, VanguardBone.RightForearm,
      posedRightElbowX, rightElbowY, rightElbowZ,
      rightWristX, rightWristY, rightWristZ,
      positionX, positionY, positionZ, heading, scale,
    );
    writeSegmentFrame(
      matrices, entityOffset, VanguardBone.RightHand,
      rightWristX, rightWristY, rightWristZ,
      rightHandX, rightHandY, rightHandZ,
      positionX, positionY, positionZ, heading, scale,
    );
  }

  writeVanguardLocomotionLegPose(
    matrices,
    entityOffset,
    positionX,
    positionY,
    positionZ,
    heading,
    scale,
    locomotionPhase,
    locomotion,
    locomotionForward,
    locomotionRight,
    sway,
    pelvisBodyBob,
  );

  if (!analyticTwoHand) {
    writeVanguardWeaponRootFrame(
      matrices,
      entityOffset,
      weaponPose,
      rightWristX,
      rightWristY,
      rightWristZ,
      rightHandX,
      rightHandY,
      rightHandZ,
      0,
      positionX,
      positionY,
      positionZ,
      heading,
      scale,
    );
  }

}
