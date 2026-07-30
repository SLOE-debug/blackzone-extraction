import { VANGUARD_ANATOMY } from '../model/vanguard-anatomy';
import {
  VanguardBone,
  type VanguardBoneMatrixArray,
} from '../model/vanguard-bone';
import { type VanguardGaitPoseState } from './vanguard-gait-state';
import { writeSegmentFrame } from './vanguard-pose-frame';

const IK_EPSILON = 0.000001;
const IK_REACH_MARGIN = 0.012;

/** 用世界脚底锚点和解析式双段 IK 写入六段腿部骨骼。 */
export function writeVanguardLocomotionLegPose(
  matrices: VanguardBoneMatrixArray,
  entityOffset: number,
  positionX: number,
  positionY: number,
  positionZ: number,
  heading: number,
  scale: number,
  locomotionPhase: number,
  locomotion: number,
  forwardAmount: number,
  rightAmount: number,
  sway: number,
  bodyBob: number,
  gait: Readonly<VanguardGaitPoseState>,
): void {
  const leftHipX = -VANGUARD_ANATOMY.hipHalfWidth + sway * 0.75;
  const rightHipX = VANGUARD_ANATOMY.hipHalfWidth + sway * 0.75;
  const hipY = VANGUARD_ANATOMY.pelvisY + bodyBob;
  const hipZ = gait.pelvisShiftZ;
  writeLeg(
    matrices,
    entityOffset,
    -1,
    leftHipX,
    hipY,
    hipZ,
    gait.leftAnkleX,
    gait.leftAnkleY,
    gait.leftAnkleZ,
    positionX,
    positionY,
    positionZ,
    heading,
    scale,
  );
  writeLeg(
    matrices,
    entityOffset,
    1,
    rightHipX,
    hipY,
    hipZ,
    gait.rightAnkleX,
    gait.rightAnkleY,
    gait.rightAnkleZ,
    positionX,
    positionY,
    positionZ,
    heading,
    scale,
  );

  if (![locomotionPhase, locomotion, forwardAmount, rightAmount].every(Number.isFinite)) {
    throw new Error('主角腿部姿态要求有限的步态输入。');
  }
}

/** 求解一侧膝盖并写入大腿、小腿与保持前向的脚掌。 */
function writeLeg(
  matrices: VanguardBoneMatrixArray,
  entityOffset: number,
  side: -1 | 1,
  hipX: number,
  hipY: number,
  hipZ: number,
  ankleX: number,
  ankleY: number,
  ankleZ: number,
  positionX: number,
  positionY: number,
  positionZ: number,
  heading: number,
  scale: number,
): void {
  let targetX = ankleX - hipX;
  let targetY = ankleY - hipY;
  let targetZ = ankleZ - hipZ;
  const thighLength = VANGUARD_ANATOMY.thighLength;
  const shinLength = VANGUARD_ANATOMY.shinLength;
  const targetDistance = Math.max(
    Math.abs(thighLength - shinLength) + IK_EPSILON,
    Math.min(thighLength + shinLength - IK_REACH_MARGIN, Math.hypot(targetX, targetY, targetZ)),
  );
  const rawDistance = Math.max(Math.hypot(targetX, targetY, targetZ), IK_EPSILON);
  targetX /= rawDistance;
  targetY /= rawDistance;
  targetZ /= rawDistance;
  const along = (
    thighLength * thighLength
      - shinLength * shinLength
      + targetDistance * targetDistance
  ) / (2 * targetDistance);
  const bend = Math.sqrt(Math.max(0, thighLength * thighLength - along * along));

  let poleX = side * 0.24;
  let poleY = 0.08;
  let poleZ = 1;
  const poleDot = poleX * targetX + poleY * targetY + poleZ * targetZ;
  poleX -= targetX * poleDot;
  poleY -= targetY * poleDot;
  poleZ -= targetZ * poleDot;
  const poleLength = Math.max(Math.hypot(poleX, poleY, poleZ), IK_EPSILON);
  poleX /= poleLength;
  poleY /= poleLength;
  poleZ /= poleLength;

  const kneeX = hipX + targetX * along + poleX * bend;
  const kneeY = hipY + targetY * along + poleY * bend;
  const kneeZ = hipZ + targetZ * along + poleZ * bend;
  const reachableAnkleX = hipX + targetX * targetDistance;
  const reachableAnkleY = hipY + targetY * targetDistance;
  const reachableAnkleZ = hipZ + targetZ * targetDistance;
  const lift = reachableAnkleY - VANGUARD_ANATOMY.ankleY;
  const toeX = reachableAnkleX;
  const toeY = VANGUARD_ANATOMY.toeY + Math.max(0, lift);
  const toeZ = reachableAnkleZ + VANGUARD_ANATOMY.toeForward;
  const thighBone = side < 0 ? VanguardBone.LeftThigh : VanguardBone.RightThigh;
  const shinBone = side < 0 ? VanguardBone.LeftShin : VanguardBone.RightShin;
  const footBone = side < 0 ? VanguardBone.LeftFoot : VanguardBone.RightFoot;
  writeSegmentFrame(
    matrices, entityOffset, thighBone,
    hipX, hipY, hipZ,
    kneeX, kneeY, kneeZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, shinBone,
    kneeX, kneeY, kneeZ,
    reachableAnkleX, reachableAnkleY, reachableAnkleZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, footBone,
    reachableAnkleX, reachableAnkleY, reachableAnkleZ,
    toeX, toeY, toeZ,
    positionX, positionY, positionZ, heading, scale,
  );
}
