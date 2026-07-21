import {
  type VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
  type VanguardBoneMatrixArray,
} from '../model/vanguard-bone';

const EPSILON = 0.000001;

/** 写入以局部 Y 为骨骼轴线、局部 Z 尽量朝向角色正面的稳定矩阵。 */
export function writeSegmentFrame(
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
  const upForwardDot = upZ;
  forwardX -= upX * upForwardDot;
  forwardY -= upY * upForwardDot;
  forwardZ -= upZ * upForwardDot;
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
export function writeYawRollFrame(
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

/** 写入围绕局部右轴俯仰的武器根矩阵。 */
export function writePitchFrame(
  matrices: VanguardBoneMatrixArray,
  entityOffset: number,
  bone: VanguardBone,
  originX: number,
  originY: number,
  originZ: number,
  pitch: number,
  positionX: number,
  positionY: number,
  positionZ: number,
  heading: number,
  scale: number,
): void {
  const pitchCosine = Math.cos(pitch);
  const pitchSine = Math.sin(pitch);
  writeWorldFrame(
    matrices,
    entityOffset,
    bone,
    originX,
    originY,
    originZ,
    1,
    0,
    0,
    0,
    pitchCosine,
    pitchSine,
    0,
    -pitchSine,
    pitchCosine,
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
