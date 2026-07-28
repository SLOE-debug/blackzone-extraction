import { lerp } from '../../../core/math/scalar';
import { VanguardBone, type VanguardBoneMatrixArray } from '../model/vanguard-bone';
import {
  getVanguardWeaponRigProfile,
  VanguardWeaponRigSocket,
} from '../model/vanguard-weapon-rig';
import { VanguardWeaponPose } from '../model/vanguard-weapon-pose';
import { type VanguardWeaponAnimationPoseState } from './vanguard-weapon-animation-state';
import { writeBasisFrame, writeSegmentFrame } from './vanguard-pose-frame';
import { VANGUARD_WEAPON_SOCKET_DISTANCE } from './vanguard-weapon-socket-pose';
import { type VanguardTwoHandWeaponTrajectoryPose } from './vanguard-two-hand-weapon-trajectory';

const EPSILON = 0.000001;
const UPPER_ARM_LENGTH = 0.72;
const FOREARM_LENGTH = 0.62;
const IK_LEFT_OFFSET = 0;
const IK_RIGHT_OFFSET = 6;
const IK_WORKSPACE_SIZE = 12;

/** 创建由动画系统长期复用的双臂 IK 工作区。 */
export function createVanguardTwoHandIkWorkspace(): Float64Array {
  return new Float64Array(IK_WORKSPACE_SIZE);
}

/**
 * 从同一把武器的主、副握点反解左右臂，并由两握点共同写出 WeaponRoot。
 *
 * 主握点固定右掌，副握点固定左掌；解析式 Two-Bone IK 保持上臂和前臂长度，
 * 肘部朝向由连续 SoA Pole 控制，整个高频路径只复用调用方工作区。
 */
export function writeVanguardTwoHandHeavyPose(
  matrices: VanguardBoneMatrixArray,
  entityOffset: number,
  positionX: number,
  positionY: number,
  positionZ: number,
  heading: number,
  scale: number,
  stanceBlend: number,
  animation: Readonly<VanguardWeaponAnimationPoseState>,
  trajectory: Readonly<VanguardTwoHandWeaponTrajectoryPose>,
  weaponPose: VanguardWeaponPose,
  leftShoulderX: number,
  leftShoulderY: number,
  leftShoulderZ: number,
  naturalLeftWristX: number,
  naturalLeftWristY: number,
  naturalLeftWristZ: number,
  naturalLeftHandX: number,
  naturalLeftHandY: number,
  naturalLeftHandZ: number,
  rightShoulderX: number,
  rightShoulderY: number,
  rightShoulderZ: number,
  naturalRightWristX: number,
  naturalRightWristY: number,
  naturalRightWristZ: number,
  naturalRightHandX: number,
  naturalRightHandY: number,
  naturalRightHandZ: number,
  workspace: Float64Array,
): void {
  if (workspace.length < IK_WORKSPACE_SIZE) {
    throw new Error('双手重武器 IK 工作区容量不足。');
  }
  const mainWeight = Math.max(0, Math.min(1, animation.mainGripWeight * stanceBlend));
  const supportWeight = Math.max(0, Math.min(1, animation.supportGripWeight * stanceBlend));
  const naturalMainX = extendHandSocket(
    naturalRightWristX,
    naturalRightHandX,
    naturalRightWristY,
    naturalRightHandY,
    naturalRightWristZ,
    naturalRightHandZ,
    0,
  );
  const naturalMainY = extendHandSocket(
    naturalRightWristX,
    naturalRightHandX,
    naturalRightWristY,
    naturalRightHandY,
    naturalRightWristZ,
    naturalRightHandZ,
    1,
  );
  const naturalMainZ = extendHandSocket(
    naturalRightWristX,
    naturalRightHandX,
    naturalRightWristY,
    naturalRightHandY,
    naturalRightWristZ,
    naturalRightHandZ,
    2,
  );
  const naturalSupportX = extendHandSocket(
    naturalLeftWristX,
    naturalLeftHandX,
    naturalLeftWristY,
    naturalLeftHandY,
    naturalLeftWristZ,
    naturalLeftHandZ,
    0,
  );
  const naturalSupportY = extendHandSocket(
    naturalLeftWristX,
    naturalLeftHandX,
    naturalLeftWristY,
    naturalLeftHandY,
    naturalLeftWristZ,
    naturalLeftHandZ,
    1,
  );
  const naturalSupportZ = extendHandSocket(
    naturalLeftWristX,
    naturalLeftHandX,
    naturalLeftWristY,
    naturalLeftHandY,
    naturalLeftWristZ,
    naturalLeftHandZ,
    2,
  );

  const shaftX = trajectory.shaftX;
  const shaftY = trajectory.shaftY;
  const shaftZ = trajectory.shaftZ;
  const mainX = lerp(naturalMainX, trajectory.mainGripX, mainWeight);
  const mainY = lerp(naturalMainY, trajectory.mainGripY, mainWeight);
  const mainZ = lerp(naturalMainZ, trajectory.mainGripZ, mainWeight);
  const rig = getVanguardWeaponRigProfile(weaponPose);
  const mainSocket = rig.sockets[VanguardWeaponRigSocket.MainGrip];
  const supportSocket = rig.sockets[VanguardWeaponRigSocket.SupportGrip];
  const gripSpacing = mainSocket.y - supportSocket.y;
  const constrainedSupportX = mainX + shaftX * gripSpacing;
  const constrainedSupportY = mainY + shaftY * gripSpacing;
  const constrainedSupportZ = mainZ + shaftZ * gripSpacing;
  const supportX = lerp(naturalSupportX, constrainedSupportX, supportWeight);
  const supportY = lerp(naturalSupportY, constrainedSupportY, supportWeight);
  const supportZ = lerp(naturalSupportZ, constrainedSupportZ, supportWeight);

  solveArm(
    workspace,
    IK_RIGHT_OFFSET,
    rightShoulderX,
    rightShoulderY,
    rightShoulderZ,
    mainX,
    mainY,
    mainZ,
    animation.rightElbowPoleX,
    animation.rightElbowPoleY,
    animation.rightElbowPoleZ,
  );
  solveArm(
    workspace,
    IK_LEFT_OFFSET,
    leftShoulderX,
    leftShoulderY,
    leftShoulderZ,
    supportX,
    supportY,
    supportZ,
    animation.leftElbowPoleX,
    animation.leftElbowPoleY,
    animation.leftElbowPoleZ,
  );
  writeArmFrames(
    matrices,
    entityOffset,
    VanguardBone.LeftUpperArm,
    VanguardBone.LeftForearm,
    VanguardBone.LeftHand,
    workspace,
    IK_LEFT_OFFSET,
    leftShoulderX,
    leftShoulderY,
    leftShoulderZ,
    supportX,
    supportY,
    supportZ,
    positionX,
    positionY,
    positionZ,
    heading,
    scale,
  );
  writeArmFrames(
    matrices,
    entityOffset,
    VanguardBone.RightUpperArm,
    VanguardBone.RightForearm,
    VanguardBone.RightHand,
    workspace,
    IK_RIGHT_OFFSET,
    rightShoulderX,
    rightShoulderY,
    rightShoulderZ,
    mainX,
    mainY,
    mainZ,
    positionX,
    positionY,
    positionZ,
    heading,
    scale,
  );
  if (weaponPose === VanguardWeaponPose.TwoHandRanged) {
    writeBasisFrame(
      matrices,
      entityOffset,
      VanguardBone.WeaponRoot,
      supportX,
      supportY,
      supportZ,
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
      positionX,
      positionY,
      positionZ,
      heading,
      scale,
    );
  } else {
    writeWeaponRoot(
      matrices,
      entityOffset,
      mainX,
      mainY,
      mainZ,
      shaftX,
      shaftY,
      shaftZ,
      positionX,
      positionY,
      positionZ,
      heading,
      scale,
    );
  }
}

function solveArm(
  result: Float64Array,
  offset: number,
  shoulderX: number,
  shoulderY: number,
  shoulderZ: number,
  gripX: number,
  gripY: number,
  gripZ: number,
  poleX: number,
  poleY: number,
  poleZ: number,
): void {
  let handDirectionX = gripX - shoulderX;
  let handDirectionY = gripY - shoulderY;
  let handDirectionZ = gripZ - shoulderZ;
  const handDirectionLength = Math.max(
    Math.hypot(handDirectionX, handDirectionY, handDirectionZ),
    EPSILON,
  );
  handDirectionX /= handDirectionLength;
  handDirectionY /= handDirectionLength;
  handDirectionZ /= handDirectionLength;
  const wristX = gripX - handDirectionX * VANGUARD_WEAPON_SOCKET_DISTANCE;
  const wristY = gripY - handDirectionY * VANGUARD_WEAPON_SOCKET_DISTANCE;
  const wristZ = gripZ - handDirectionZ * VANGUARD_WEAPON_SOCKET_DISTANCE;
  let targetX = wristX - shoulderX;
  let targetY = wristY - shoulderY;
  let targetZ = wristZ - shoulderZ;
  const rawDistance = Math.max(Math.hypot(targetX, targetY, targetZ), EPSILON);
  const distance = Math.max(
    Math.abs(UPPER_ARM_LENGTH - FOREARM_LENGTH) + 0.01,
    Math.min(UPPER_ARM_LENGTH + FOREARM_LENGTH - 0.01, rawDistance),
  );
  targetX /= rawDistance;
  targetY /= rawDistance;
  targetZ /= rawDistance;
  const along = (
    UPPER_ARM_LENGTH * UPPER_ARM_LENGTH
      - FOREARM_LENGTH * FOREARM_LENGTH
      + distance * distance
  ) / (2 * distance);
  const bend = Math.sqrt(Math.max(0, UPPER_ARM_LENGTH * UPPER_ARM_LENGTH - along * along));
  let poleDirectionX = poleX - shoulderX;
  let poleDirectionY = poleY - shoulderY;
  let poleDirectionZ = poleZ - shoulderZ;
  const poleDot = poleDirectionX * targetX
    + poleDirectionY * targetY
    + poleDirectionZ * targetZ;
  poleDirectionX -= targetX * poleDot;
  poleDirectionY -= targetY * poleDot;
  poleDirectionZ -= targetZ * poleDot;
  const poleLength = Math.max(
    Math.hypot(poleDirectionX, poleDirectionY, poleDirectionZ),
    EPSILON,
  );
  poleDirectionX /= poleLength;
  poleDirectionY /= poleLength;
  poleDirectionZ /= poleLength;
  result[offset] = shoulderX + targetX * along + poleDirectionX * bend;
  result[offset + 1] = shoulderY + targetY * along + poleDirectionY * bend;
  result[offset + 2] = shoulderZ + targetZ * along + poleDirectionZ * bend;
  result[offset + 3] = shoulderX + targetX * distance;
  result[offset + 4] = shoulderY + targetY * distance;
  result[offset + 5] = shoulderZ + targetZ * distance;
}

function writeArmFrames(
  matrices: VanguardBoneMatrixArray,
  entityOffset: number,
  upperArm: VanguardBone,
  forearm: VanguardBone,
  hand: VanguardBone,
  solved: Float64Array,
  offset: number,
  shoulderX: number,
  shoulderY: number,
  shoulderZ: number,
  gripX: number,
  gripY: number,
  gripZ: number,
  positionX: number,
  positionY: number,
  positionZ: number,
  heading: number,
  scale: number,
): void {
  const elbowX = solved[offset] ?? shoulderX;
  const elbowY = solved[offset + 1] ?? shoulderY;
  const elbowZ = solved[offset + 2] ?? shoulderZ;
  const wristX = solved[offset + 3] ?? gripX;
  const wristY = solved[offset + 4] ?? gripY;
  const wristZ = solved[offset + 5] ?? gripZ;
  writeSegmentFrame(
    matrices, entityOffset, upperArm,
    shoulderX, shoulderY, shoulderZ,
    elbowX, elbowY, elbowZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, forearm,
    elbowX, elbowY, elbowZ,
    wristX, wristY, wristZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, hand,
    wristX, wristY, wristZ,
    gripX, gripY, gripZ,
    positionX, positionY, positionZ, heading, scale,
  );
}

function writeWeaponRoot(
  matrices: VanguardBoneMatrixArray,
  entityOffset: number,
  mainX: number,
  mainY: number,
  mainZ: number,
  shaftX: number,
  shaftY: number,
  shaftZ: number,
  positionX: number,
  positionY: number,
  positionZ: number,
  heading: number,
  scale: number,
): void {
  const upX = -shaftX;
  const upY = -shaftY;
  const upZ = -shaftZ;
  const forwardDot = upZ;
  let forwardX = -upX * forwardDot;
  let forwardY = -upY * forwardDot;
  let forwardZ = 1 - upZ * forwardDot;
  let forwardLength = Math.hypot(forwardX, forwardY, forwardZ);
  if (forwardLength <= EPSILON) {
    forwardX = 1 - upX * upX;
    forwardY = -upX * upY;
    forwardZ = -upX * upZ;
    forwardLength = Math.max(Math.hypot(forwardX, forwardY, forwardZ), EPSILON);
  }
  forwardX /= forwardLength;
  forwardY /= forwardLength;
  forwardZ /= forwardLength;
  const rightX = upY * forwardZ - upZ * forwardY;
  const rightY = upZ * forwardX - upX * forwardZ;
  const rightZ = upX * forwardY - upY * forwardX;
  writeBasisFrame(
    matrices,
    entityOffset,
    VanguardBone.WeaponRoot,
    mainX,
    mainY,
    mainZ,
    rightX,
    rightY,
    rightZ,
    upX,
    upY,
    upZ,
    forwardX,
    forwardY,
    forwardZ,
    positionX,
    positionY,
    positionZ,
    heading,
    scale,
  );
}

function extendHandSocket(
  wristX: number,
  handX: number,
  wristY: number,
  handY: number,
  wristZ: number,
  handZ: number,
  axis: 0 | 1 | 2,
): number {
  const directionX = handX - wristX;
  const directionY = handY - wristY;
  const directionZ = handZ - wristZ;
  const inverseLength = 1 / Math.max(
    Math.hypot(directionX, directionY, directionZ),
    EPSILON,
  );
  if (axis === 0) {
    return wristX + directionX * inverseLength * VANGUARD_WEAPON_SOCKET_DISTANCE;
  }
  if (axis === 1) {
    return wristY + directionY * inverseLength * VANGUARD_WEAPON_SOCKET_DISTANCE;
  }
  return wristZ + directionZ * inverseLength * VANGUARD_WEAPON_SOCKET_DISTANCE;
}
