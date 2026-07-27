import { VANGUARD_ANATOMY } from '../model/vanguard-anatomy';
import {
  VanguardBone,
  type VanguardBoneMatrixArray,
} from '../model/vanguard-bone';
import { writeSegmentFrame } from './vanguard-pose-frame';

/** 按角色局部前后与左右速度写入六段腿部骨骼，避免横移继续播放正向步态。 */
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
): void {
  const strideWave = Math.sin(locomotionPhase);
  const backwardScale = forwardAmount < 0 ? 0.68 : 1;
  const forwardStrideScale = (0.16 + Math.abs(forwardAmount) * 0.84) * backwardScale;
  const stride = strideWave * 0.72 * locomotion * forwardStrideScale;
  const lateralStride = strideWave * 0.62 * locomotion * rightAmount;
  const leftStepLift = Math.max(0, strideWave) * 0.36 * locomotion;
  const rightStepLift = Math.max(0, -strideWave) * 0.36 * locomotion;
  const leftHipX = -VANGUARD_ANATOMY.hipHalfWidth + sway * 0.75;
  const rightHipX = VANGUARD_ANATOMY.hipHalfWidth + sway * 0.75;
  const leftKneeX = -0.35 + lateralStride * 0.56;
  const rightKneeX = 0.35 - lateralStride * 0.56;
  const leftAnkleX = -0.36 + lateralStride;
  const rightAnkleX = 0.36 - lateralStride;
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
    leftKneeX, leftKneeY, leftKneeZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.LeftShin,
    leftKneeX, leftKneeY, leftKneeZ,
    leftAnkleX, leftAnkleY, leftAnkleZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.LeftFoot,
    leftAnkleX, leftAnkleY, leftAnkleZ,
    leftAnkleX, VANGUARD_ANATOMY.toeY + leftStepLift, leftFootZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.RightThigh,
    rightHipX, VANGUARD_ANATOMY.pelvisY + bodyBob, 0,
    rightKneeX, rightKneeY, rightKneeZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.RightShin,
    rightKneeX, rightKneeY, rightKneeZ,
    rightAnkleX, rightAnkleY, rightAnkleZ,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.RightFoot,
    rightAnkleX, rightAnkleY, rightAnkleZ,
    rightAnkleX, VANGUARD_ANATOMY.toeY + rightStepLift, rightFootZ,
    positionX, positionY, positionZ, heading, scale,
  );
}
