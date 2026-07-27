import { lerp } from '../../../core/math/scalar';
import { type VanguardTwoHandWeaponTrajectoryPose } from './vanguard-two-hand-weapon-trajectory';

const EPSILON = 0.000001;

export type VanguardWeaponTrajectoryKeyframe = Readonly<VanguardTwoHandWeaponTrajectoryPose>;
export type VanguardWeaponTrajectoryVelocity = Readonly<VanguardTwoHandWeaponTrajectoryPose>;

/** 创建归一化锤杆方向的不可变轨迹关键帧。 */
export function createVanguardWeaponTrajectoryKeyframe(
  mainGripX: number,
  mainGripY: number,
  mainGripZ: number,
  shaftX: number,
  shaftY: number,
  shaftZ: number,
  chestYaw: number,
  pelvisYaw: number,
  leftElbowPoleX: number,
  leftElbowPoleY: number,
  leftElbowPoleZ: number,
  rightElbowPoleX: number,
  rightElbowPoleY: number,
  rightElbowPoleZ: number,
  supportGripWeight: number,
): VanguardWeaponTrajectoryKeyframe {
  const length = Math.max(Math.hypot(shaftX, shaftY, shaftZ), EPSILON);
  return Object.freeze({
    mainGripX,
    mainGripY,
    mainGripZ,
    shaftX: shaftX / length,
    shaftY: shaftY / length,
    shaftZ: shaftZ / length,
    chestYaw,
    pelvisYaw,
    leftElbowPoleX,
    leftElbowPoleY,
    leftElbowPoleZ,
    rightElbowPoleX,
    rightElbowPoleY,
    rightElbowPoleZ,
    supportGripWeight,
  });
}

/** 由相邻关键帧差分生成 Catmull–Rom 风格的每秒共享切线。 */
export function createVanguardWeaponTrajectoryVelocity(
  previous: VanguardWeaponTrajectoryKeyframe,
  next: VanguardWeaponTrajectoryKeyframe,
  spanSeconds: number,
): VanguardWeaponTrajectoryVelocity {
  const inverseSpan = 1 / Math.max(spanSeconds, EPSILON);
  return Object.freeze({
    mainGripX: (next.mainGripX - previous.mainGripX) * inverseSpan,
    mainGripY: (next.mainGripY - previous.mainGripY) * inverseSpan,
    mainGripZ: (next.mainGripZ - previous.mainGripZ) * inverseSpan,
    shaftX: (next.shaftX - previous.shaftX) * inverseSpan,
    shaftY: (next.shaftY - previous.shaftY) * inverseSpan,
    shaftZ: (next.shaftZ - previous.shaftZ) * inverseSpan,
    chestYaw: (next.chestYaw - previous.chestYaw) * inverseSpan,
    pelvisYaw: (next.pelvisYaw - previous.pelvisYaw) * inverseSpan,
    leftElbowPoleX: (next.leftElbowPoleX - previous.leftElbowPoleX) * inverseSpan,
    leftElbowPoleY: (next.leftElbowPoleY - previous.leftElbowPoleY) * inverseSpan,
    leftElbowPoleZ: (next.leftElbowPoleZ - previous.leftElbowPoleZ) * inverseSpan,
    rightElbowPoleX: (next.rightElbowPoleX - previous.rightElbowPoleX) * inverseSpan,
    rightElbowPoleY: (next.rightElbowPoleY - previous.rightElbowPoleY) * inverseSpan,
    rightElbowPoleZ: (next.rightElbowPoleZ - previous.rightElbowPoleZ) * inverseSpan,
    supportGripWeight: (next.supportGripWeight - previous.supportGripWeight) * inverseSpan,
  });
}

/** 创建静止端点使用的零速度切线。 */
export function createZeroVanguardWeaponTrajectoryVelocity(): VanguardWeaponTrajectoryVelocity {
  return Object.freeze({
    mainGripX: 0,
    mainGripY: 0,
    mainGripZ: 0,
    shaftX: 0,
    shaftY: 0,
    shaftZ: 0,
    chestYaw: 0,
    pelvisYaw: 0,
    leftElbowPoleX: 0,
    leftElbowPoleY: 0,
    leftElbowPoleZ: 0,
    rightElbowPoleX: 0,
    rightElbowPoleY: 0,
    rightElbowPoleZ: 0,
    supportGripWeight: 0,
  });
}

/** 以每秒切线采样三次 Hermite 段，保证相邻动作边界的真实速度一致。 */
export function writeVanguardWeaponHermitePose(
  result: VanguardTwoHandWeaponTrajectoryPose,
  start: VanguardWeaponTrajectoryKeyframe,
  end: VanguardWeaponTrajectoryKeyframe,
  startVelocity: VanguardWeaponTrajectoryVelocity,
  endVelocity: VanguardWeaponTrajectoryVelocity,
  durationSeconds: number,
  progress: number,
): void {
  const amount = Math.max(0, Math.min(1, progress));
  const squared = amount * amount;
  const cubed = squared * amount;
  const startWeight = 2 * cubed - 3 * squared + 1;
  const startTangentWeight = (cubed - 2 * squared + amount) * durationSeconds;
  const endWeight = -2 * cubed + 3 * squared;
  const endTangentWeight = (cubed - squared) * durationSeconds;
  result.mainGripX = hermite(start.mainGripX, end.mainGripX, startVelocity.mainGripX, endVelocity.mainGripX, startWeight, startTangentWeight, endWeight, endTangentWeight);
  result.mainGripY = hermite(start.mainGripY, end.mainGripY, startVelocity.mainGripY, endVelocity.mainGripY, startWeight, startTangentWeight, endWeight, endTangentWeight);
  result.mainGripZ = hermite(start.mainGripZ, end.mainGripZ, startVelocity.mainGripZ, endVelocity.mainGripZ, startWeight, startTangentWeight, endWeight, endTangentWeight);
  result.shaftX = hermite(start.shaftX, end.shaftX, startVelocity.shaftX, endVelocity.shaftX, startWeight, startTangentWeight, endWeight, endTangentWeight);
  result.shaftY = hermite(start.shaftY, end.shaftY, startVelocity.shaftY, endVelocity.shaftY, startWeight, startTangentWeight, endWeight, endTangentWeight);
  result.shaftZ = hermite(start.shaftZ, end.shaftZ, startVelocity.shaftZ, endVelocity.shaftZ, startWeight, startTangentWeight, endWeight, endTangentWeight);
  result.chestYaw = hermite(start.chestYaw, end.chestYaw, startVelocity.chestYaw, endVelocity.chestYaw, startWeight, startTangentWeight, endWeight, endTangentWeight);
  result.pelvisYaw = hermite(start.pelvisYaw, end.pelvisYaw, startVelocity.pelvisYaw, endVelocity.pelvisYaw, startWeight, startTangentWeight, endWeight, endTangentWeight);
  result.leftElbowPoleX = hermite(start.leftElbowPoleX, end.leftElbowPoleX, startVelocity.leftElbowPoleX, endVelocity.leftElbowPoleX, startWeight, startTangentWeight, endWeight, endTangentWeight);
  result.leftElbowPoleY = hermite(start.leftElbowPoleY, end.leftElbowPoleY, startVelocity.leftElbowPoleY, endVelocity.leftElbowPoleY, startWeight, startTangentWeight, endWeight, endTangentWeight);
  result.leftElbowPoleZ = hermite(start.leftElbowPoleZ, end.leftElbowPoleZ, startVelocity.leftElbowPoleZ, endVelocity.leftElbowPoleZ, startWeight, startTangentWeight, endWeight, endTangentWeight);
  result.rightElbowPoleX = hermite(start.rightElbowPoleX, end.rightElbowPoleX, startVelocity.rightElbowPoleX, endVelocity.rightElbowPoleX, startWeight, startTangentWeight, endWeight, endTangentWeight);
  result.rightElbowPoleY = hermite(start.rightElbowPoleY, end.rightElbowPoleY, startVelocity.rightElbowPoleY, endVelocity.rightElbowPoleY, startWeight, startTangentWeight, endWeight, endTangentWeight);
  result.rightElbowPoleZ = hermite(start.rightElbowPoleZ, end.rightElbowPoleZ, startVelocity.rightElbowPoleZ, endVelocity.rightElbowPoleZ, startWeight, startTangentWeight, endWeight, endTangentWeight);
  result.supportGripWeight = hermite(start.supportGripWeight, end.supportGripWeight, startVelocity.supportGripWeight, endVelocity.supportGripWeight, startWeight, startTangentWeight, endWeight, endTangentWeight);
}

/** 线性写入无需共享切线的技能姿态。 */
export function interpolateVanguardWeaponTrajectoryPose(
  result: VanguardTwoHandWeaponTrajectoryPose,
  start: VanguardWeaponTrajectoryKeyframe,
  end: VanguardWeaponTrajectoryKeyframe,
  amount: number,
): void {
  result.mainGripX = lerp(start.mainGripX, end.mainGripX, amount);
  result.mainGripY = lerp(start.mainGripY, end.mainGripY, amount);
  result.mainGripZ = lerp(start.mainGripZ, end.mainGripZ, amount);
  result.shaftX = lerp(start.shaftX, end.shaftX, amount);
  result.shaftY = lerp(start.shaftY, end.shaftY, amount);
  result.shaftZ = lerp(start.shaftZ, end.shaftZ, amount);
  result.chestYaw = lerp(start.chestYaw, end.chestYaw, amount);
  result.pelvisYaw = lerp(start.pelvisYaw, end.pelvisYaw, amount);
  result.leftElbowPoleX = lerp(start.leftElbowPoleX, end.leftElbowPoleX, amount);
  result.leftElbowPoleY = lerp(start.leftElbowPoleY, end.leftElbowPoleY, amount);
  result.leftElbowPoleZ = lerp(start.leftElbowPoleZ, end.leftElbowPoleZ, amount);
  result.rightElbowPoleX = lerp(start.rightElbowPoleX, end.rightElbowPoleX, amount);
  result.rightElbowPoleY = lerp(start.rightElbowPoleY, end.rightElbowPoleY, amount);
  result.rightElbowPoleZ = lerp(start.rightElbowPoleZ, end.rightElbowPoleZ, amount);
  result.supportGripWeight = lerp(start.supportGripWeight, end.supportGripWeight, amount);
}

/** 复制完整轨迹关键帧。 */
export function copyVanguardWeaponTrajectoryPose(
  result: VanguardTwoHandWeaponTrajectoryPose,
  source: VanguardWeaponTrajectoryKeyframe,
): void {
  interpolateVanguardWeaponTrajectoryPose(result, source, source, 0);
}

function hermite(
  start: number,
  end: number,
  startVelocity: number,
  endVelocity: number,
  startWeight: number,
  startTangentWeight: number,
  endWeight: number,
  endTangentWeight: number,
): number {
  return start * startWeight
    + startVelocity * startTangentWeight
    + end * endWeight
    + endVelocity * endTangentWeight;
}
