import { VANGUARD_ANATOMY } from '../model/vanguard-anatomy';
import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
  type VanguardBoneMatrixArray,
} from '../model/vanguard-bone';

const EPSILON = 0.000001;

/** 创建供程序化人体拓扑预计算绑定坐标使用的中立骨骼矩阵。 */
export function createVanguardBindPoseMatrices(): Float64Array {
  const matrices = new Float64Array(
    VanguardBone.Count * VANGUARD_BONE_MATRIX_COMPONENTS,
  );
  writeVanguardPoseMatrices(matrices, 0, 0, 0, 0, 0, 1, 0);
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
): void {
  const entityOffset = entityIndex
    * VanguardBone.Count
    * VANGUARD_BONE_MATRIX_COMPONENTS;
  const breath = Math.sin(phase * 2) * 0.018;
  const sway = Math.sin(phase) * 0.018;
  const shrugWave = Math.max(0, -Math.sin(phase));
  const shoulderLift = shrugWave * shrugWave * shrugWave * shrugWave * 0.035;
  const headYaw = Math.sin(phase) * 0.16 + Math.sin(phase * 2) * 0.025;
  const armRelax = Math.sin(phase * 2) * 0.008;

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
    VANGUARD_ANATOMY.pelvisY,
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
    VANGUARD_ANATOMY.chestY + breath,
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
    VANGUARD_ANATOMY.neckY + breath * 0.75,
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
    VANGUARD_ANATOMY.headPivotY + breath * 0.7,
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
  const shoulderY = VANGUARD_ANATOMY.shoulderY + breath * 0.55;
  const leftShoulderLift = shoulderLift * 0.9;
  const rightShoulderLift = shoulderLift;
  const leftElbowX = VANGUARD_ANATOMY.leftElbowX + sway * 0.06;
  const leftElbowY = VANGUARD_ANATOMY.leftElbowY + leftShoulderLift * 0.45;
  const leftWristX = VANGUARD_ANATOMY.leftWristX - armRelax;
  const leftWristY = VANGUARD_ANATOMY.leftWristY + leftShoulderLift * 0.18;
  const rightElbowX = VANGUARD_ANATOMY.rightElbowX + sway * 0.04;
  const rightElbowY = VANGUARD_ANATOMY.rightElbowY + rightShoulderLift * 0.42;
  const rightWristX = VANGUARD_ANATOMY.rightWristX + armRelax;
  const rightWristY = VANGUARD_ANATOMY.rightWristY + rightShoulderLift * 0.18;

  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.LeftUpperArm,
    leftShoulderX, shoulderY + leftShoulderLift, 0,
    leftElbowX, leftElbowY, 0.025,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.LeftForearm,
    leftElbowX, leftElbowY, 0.025,
    leftWristX, leftWristY, 0.065,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.LeftHand,
    leftWristX, leftWristY, 0.065,
    VANGUARD_ANATOMY.leftHandX - armRelax * 1.2,
    VANGUARD_ANATOMY.leftHandY + leftShoulderLift * 0.1,
    0.12,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.RightUpperArm,
    rightShoulderX, shoulderY + rightShoulderLift, 0.008,
    rightElbowX, rightElbowY, 0.04,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.RightForearm,
    rightElbowX, rightElbowY, 0.04,
    rightWristX, rightWristY, 0.09,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.RightHand,
    rightWristX, rightWristY, 0.09,
    VANGUARD_ANATOMY.rightHandX + armRelax * 1.2,
    VANGUARD_ANATOMY.rightHandY + rightShoulderLift * 0.1,
    0.14,
    positionX, positionY, positionZ, heading, scale,
  );

  const leftHipX = -VANGUARD_ANATOMY.hipHalfWidth + sway * 0.75;
  const rightHipX = VANGUARD_ANATOMY.hipHalfWidth + sway * 0.75;
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.LeftThigh,
    leftHipX, VANGUARD_ANATOMY.pelvisY, 0,
    -0.32, VANGUARD_ANATOMY.kneeY, 0.025,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.LeftShin,
    -0.32, VANGUARD_ANATOMY.kneeY, 0.025,
    -0.33, VANGUARD_ANATOMY.ankleY, 0,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.LeftFoot,
    -0.33, VANGUARD_ANATOMY.ankleY, 0,
    -0.33, VANGUARD_ANATOMY.toeY, VANGUARD_ANATOMY.toeForward,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.RightThigh,
    rightHipX, VANGUARD_ANATOMY.pelvisY, 0,
    0.31, VANGUARD_ANATOMY.kneeY + 0.015, -0.015,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.RightShin,
    0.31, VANGUARD_ANATOMY.kneeY + 0.015, -0.015,
    0.32, VANGUARD_ANATOMY.ankleY, 0,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.RightFoot,
    0.32, VANGUARD_ANATOMY.ankleY, 0,
    0.32, VANGUARD_ANATOMY.toeY, VANGUARD_ANATOMY.toeForward + 0.015,
    positionX, positionY, positionZ, heading, scale,
  );

  const scarfWave = Math.sin(phase * 2) * 0.034 + Math.sin(phase) * 0.012;
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.LeftScarfTail,
    -0.12, 3.08 + breath * 0.7, 0.18,
    -0.42 + scarfWave, 2.35, 0.24,
    positionX, positionY, positionZ, heading, scale,
  );
  writeSegmentFrame(
    matrices, entityOffset, VanguardBone.RightScarfTail,
    0.12, 3.08 + breath * 0.7, 0.04,
    0.34 - scarfWave * 0.65, 2.55, -0.14,
    positionX, positionY, positionZ, heading, scale,
  );
}

/** 写入以局部 Y 为骨骼轴线、局部 Z 尽量朝向角色正面的稳定矩阵。 */
function writeSegmentFrame(
  matrices: VanguardBoneMatrixArray,
  entityOffset: number,
  bone: VanguardBone,
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  positionX: number,
  positionY: number,
  positionZ: number,
  heading: number,
  scale: number,
): void {
  let upX = endX - startX;
  let upY = endY - startY;
  let upZ = endZ - startZ;
  const upLength = Math.max(Math.hypot(upX, upY, upZ), EPSILON);
  upX /= upLength;
  upY /= upLength;
  upZ /= upLength;

  let forwardX = 0;
  let forwardY = 0;
  let forwardZ = 1;
  let dot = upZ;
  forwardX -= upX * dot;
  forwardY -= upY * dot;
  forwardZ -= upZ * dot;
  let forwardLength = Math.hypot(forwardX, forwardY, forwardZ);
  if (forwardLength <= EPSILON) {
    forwardX = -upX * upY;
    forwardY = 1 - upY * upY;
    forwardZ = -upZ * upY;
    forwardLength = Math.max(Math.hypot(forwardX, forwardY, forwardZ), EPSILON);
  }
  forwardX /= forwardLength;
  forwardY /= forwardLength;
  forwardZ /= forwardLength;

  let rightX = upY * forwardZ - upZ * forwardY;
  let rightY = upZ * forwardX - upX * forwardZ;
  let rightZ = upX * forwardY - upY * forwardX;
  const rightLength = Math.max(Math.hypot(rightX, rightY, rightZ), EPSILON);
  rightX /= rightLength;
  rightY /= rightLength;
  rightZ /= rightLength;
  forwardX = rightY * upZ - rightZ * upY;
  forwardY = rightZ * upX - rightX * upZ;
  forwardZ = rightX * upY - rightY * upX;

  writeWorldFrame(
    matrices,
    entityOffset,
    bone,
    startX,
    startY,
    startZ,
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

/** 写入带局部偏航和侧倾的躯干、颈部及头部矩阵。 */
function writeYawRollFrame(
  matrices: VanguardBoneMatrixArray,
  entityOffset: number,
  bone: VanguardBone,
  originX: number,
  originY: number,
  originZ: number,
  yaw: number,
  roll: number,
  positionX: number,
  positionY: number,
  positionZ: number,
  heading: number,
  scale: number,
): void {
  const yawCosine = Math.cos(yaw);
  const yawSine = Math.sin(yaw);
  const rollCosine = Math.cos(roll);
  const rollSine = Math.sin(roll);
  writeWorldFrame(
    matrices,
    entityOffset,
    bone,
    originX,
    originY,
    originZ,
    yawCosine * rollCosine,
    rollSine,
    -yawSine * rollCosine,
    -yawCosine * rollSine,
    rollCosine,
    yawSine * rollSine,
    yawSine,
    0,
    yawCosine,
    positionX,
    positionY,
    positionZ,
    heading,
    scale,
  );
}

/** 把角色局部矩阵旋转、缩放并平移到世界空间。 */
function writeWorldFrame(
  matrices: VanguardBoneMatrixArray,
  entityOffset: number,
  bone: VanguardBone,
  originX: number,
  originY: number,
  originZ: number,
  rightX: number,
  rightY: number,
  rightZ: number,
  upX: number,
  upY: number,
  upZ: number,
  forwardX: number,
  forwardY: number,
  forwardZ: number,
  positionX: number,
  positionY: number,
  positionZ: number,
  heading: number,
  scale: number,
): void {
  const headingCosine = Math.cos(heading);
  const headingSine = Math.sin(heading);
  const offset = entityOffset + bone * VANGUARD_BONE_MATRIX_COMPONENTS;
  matrices[offset] = (rightX * headingCosine + rightZ * headingSine) * scale;
  matrices[offset + 1] = rightY * scale;
  matrices[offset + 2] = (-rightX * headingSine + rightZ * headingCosine) * scale;
  matrices[offset + 3] = (upX * headingCosine + upZ * headingSine) * scale;
  matrices[offset + 4] = upY * scale;
  matrices[offset + 5] = (-upX * headingSine + upZ * headingCosine) * scale;
  matrices[offset + 6] = (forwardX * headingCosine + forwardZ * headingSine) * scale;
  matrices[offset + 7] = forwardY * scale;
  matrices[offset + 8] = (-forwardX * headingSine + forwardZ * headingCosine) * scale;
  matrices[offset + 9] = positionX
    + (originX * headingCosine + originZ * headingSine) * scale;
  matrices[offset + 10] = positionY + originY * scale;
  matrices[offset + 11] = positionZ
    + (-originX * headingSine + originZ * headingCosine) * scale;
}
