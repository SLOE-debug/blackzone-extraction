import { lerp } from '../../../core/math/scalar';
import { VanguardWeaponAction } from '../model/vanguard-weapon-action';

const EPSILON = 0.000001;

/** 双手重武器在角色局部空间中的完整动作目标。 */
export interface VanguardTwoHandWeaponTrajectoryPose {
  mainGripX: number;
  mainGripY: number;
  mainGripZ: number;
  shaftX: number;
  shaftY: number;
  shaftZ: number;
  chestYaw: number;
  pelvisYaw: number;
  leftElbowPoleX: number;
  leftElbowPoleY: number;
  leftElbowPoleZ: number;
  rightElbowPoleX: number;
  rightElbowPoleY: number;
  rightElbowPoleZ: number;
  supportGripWeight: number;
}

type ReadonlyTrajectoryKeyframe = Readonly<VanguardTwoHandWeaponTrajectoryPose>;

const IDLE_POSE = createKeyframe(
  0.58, 1.68, 0.26,
  0.18, -0.96, 0.22,
  0, 0,
  -1.34, 2.3, 0.82,
  1.34, 2.3, 0.82,
  0,
);
const LEFT_WINDUP_POSE = createKeyframe(
  -0.08, 2.18, 0.62,
  0.7, -0.1, 0.71,
  -0.2, -0.09,
  -1.8, 2.42, 1.08,
  1.76, 2.4, 1.04,
  1,
);
const LEFT_FOLLOW_THROUGH_POSE = createKeyframe(
  -0.08, 2.2, 0.76,
  -0.7, -0.08, 0.71,
  0.14, 0.07,
  -1.76, 2.38, 1.05,
  1.8, 2.42, 1.1,
  1,
);
const RIGHT_WINDUP_POSE = createKeyframe(
  0.08, 2.18, 0.62,
  -0.7, -0.1, 0.71,
  0.2, 0.09,
  -1.76, 2.4, 1.04,
  1.8, 2.42, 1.08,
  1,
);
const RIGHT_FOLLOW_THROUGH_POSE = createKeyframe(
  0.08, 2.2, 0.76,
  0.7, -0.08, 0.71,
  -0.14, -0.07,
  -1.8, 2.42, 1.1,
  1.76, 2.38, 1.05,
  1,
);
const UPPERCUT_APEX_POSE = createKeyframe(
  0, 2.18, 0.74,
  0, 0.68, 0.74,
  0, 0,
  -1.82, 2.5, 1.14,
  1.82, 2.5, 1.14,
  1,
);
const GROUND_SLAM_RAISED_POSE = createKeyframe(
  0, 2.52, 0.68,
  0, 0.74, -0.68,
  0, 0,
  -1.82, 2.55, 0.96,
  1.82, 2.55, 0.96,
  1,
);
const GROUND_SLAM_IMPACT_POSE = createKeyframe(
  0, 2.15, 0.75,
  0, -0.96, 0.28,
  0, 0,
  -1.8, 2.24, 1.12,
  1.8, 2.24, 1.12,
  1,
);
const SPIN_POSE = createKeyframe(
  0, 2.2, 0.72,
  0.98, -0.12, 0.16,
  0, 0,
  -1.82, 2.4, 1.08,
  1.82, 2.4, 1.08,
  1,
);

/** 创建供动画系统跨帧复用的完整轨迹输出。 */
export function createVanguardTwoHandWeaponTrajectoryPose(): VanguardTwoHandWeaponTrajectoryPose {
  return { ...IDLE_POSE };
}

/**
 * 按动作时间轴写出主握点、锤杆、躯干、双肘和副手参与度。
 *
 * 普通横扫的三个阶段共享完全相同的端点，五次平滑插值让边界位置和速度连续。
 */
export function writeVanguardTwoHandWeaponTrajectory(
  result: VanguardTwoHandWeaponTrajectoryPose,
  action: VanguardWeaponAction,
  progress: number,
  recoverSide: -1 | 0 | 1,
  yawLag: number,
): void {
  const amount = Math.max(0, Math.min(1, progress));
  switch (action) {
    case VanguardWeaponAction.WindupLeft:
      interpolatePose(result, IDLE_POSE, LEFT_WINDUP_POSE, smootherStep(amount));
      result.supportGripWeight = smoothStepRange(0, 0.32, amount);
      break;
    case VanguardWeaponAction.WindupRight:
      interpolatePose(result, IDLE_POSE, RIGHT_WINDUP_POSE, smootherStep(amount));
      result.supportGripWeight = smoothStepRange(0, 0.32, amount);
      break;
    case VanguardWeaponAction.SwingLeft:
      interpolatePose(result, LEFT_WINDUP_POSE, LEFT_FOLLOW_THROUGH_POSE, smootherStep(amount));
      break;
    case VanguardWeaponAction.SwingRight:
      interpolatePose(result, RIGHT_WINDUP_POSE, RIGHT_FOLLOW_THROUGH_POSE, smootherStep(amount));
      break;
    case VanguardWeaponAction.Recover: {
      const start = recoverSide < 0
        ? LEFT_FOLLOW_THROUGH_POSE
        : RIGHT_FOLLOW_THROUGH_POSE;
      interpolatePose(result, start, IDLE_POSE, smootherStep(amount));
      result.supportGripWeight = 1 - smoothStepRange(0.65, 1, amount);
      break;
    }
    case VanguardWeaponAction.Uppercut:
      writeRoundTripPose(result, IDLE_POSE, UPPERCUT_APEX_POSE, amount, 0.55);
      result.supportGripWeight = getSkillSupportGripWeight(amount, 0.82);
      break;
    case VanguardWeaponAction.GroundSlam:
      if (amount < 0.42) {
        interpolatePose(
          result,
          IDLE_POSE,
          GROUND_SLAM_RAISED_POSE,
          smootherStep(amount / 0.42),
        );
      } else if (amount < 0.74) {
        interpolatePose(
          result,
          GROUND_SLAM_RAISED_POSE,
          GROUND_SLAM_IMPACT_POSE,
          smootherStep((amount - 0.42) / 0.32),
        );
      } else {
        interpolatePose(
          result,
          GROUND_SLAM_IMPACT_POSE,
          IDLE_POSE,
          smootherStep((amount - 0.74) / 0.26),
        );
      }
      result.supportGripWeight = getSkillSupportGripWeight(amount, 0.84);
      break;
    case VanguardWeaponAction.Spin:
      if (amount < 0.08) {
        interpolatePose(result, IDLE_POSE, SPIN_POSE, smootherStep(amount / 0.08));
      } else if (amount > 0.92) {
        interpolatePose(result, SPIN_POSE, IDLE_POSE, smootherStep((amount - 0.92) / 0.08));
      } else {
        copyPose(result, SPIN_POSE);
        const angle = (amount - 0.08) / 0.84 * Math.PI * 6;
        result.shaftX = Math.cos(angle) * 0.98;
        result.shaftZ = Math.sin(angle) * 0.98;
      }
      result.supportGripWeight = getSkillSupportGripWeight(amount, 0.92);
      break;
    case VanguardWeaponAction.Idle:
      copyPose(result, IDLE_POSE);
      break;
  }
  rotateAndNormalizeShaft(result, yawLag);
}

function createKeyframe(
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
): ReadonlyTrajectoryKeyframe {
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

function writeRoundTripPose(
  result: VanguardTwoHandWeaponTrajectoryPose,
  start: ReadonlyTrajectoryKeyframe,
  apex: ReadonlyTrajectoryKeyframe,
  progress: number,
  apexProgress: number,
): void {
  if (progress < apexProgress) {
    interpolatePose(result, start, apex, smootherStep(progress / apexProgress));
  } else {
    interpolatePose(
      result,
      apex,
      start,
      smootherStep((progress - apexProgress) / (1 - apexProgress)),
    );
  }
}

function interpolatePose(
  result: VanguardTwoHandWeaponTrajectoryPose,
  start: ReadonlyTrajectoryKeyframe,
  end: ReadonlyTrajectoryKeyframe,
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
  result.supportGripWeight = lerp(
    start.supportGripWeight,
    end.supportGripWeight,
    amount,
  );
}

function copyPose(
  result: VanguardTwoHandWeaponTrajectoryPose,
  source: ReadonlyTrajectoryKeyframe,
): void {
  interpolatePose(result, source, source, 0);
}

function rotateAndNormalizeShaft(
  pose: VanguardTwoHandWeaponTrajectoryPose,
  yawLag: number,
): void {
  const cosine = Math.cos(yawLag);
  const sine = Math.sin(yawLag);
  const x = pose.shaftX;
  const z = pose.shaftZ;
  pose.shaftX = x * cosine + z * sine;
  pose.shaftZ = -x * sine + z * cosine;
  const length = Math.max(Math.hypot(pose.shaftX, pose.shaftY, pose.shaftZ), EPSILON);
  pose.shaftX /= length;
  pose.shaftY /= length;
  pose.shaftZ /= length;
}

function smootherStep(progress: number): number {
  const amount = Math.max(0, Math.min(1, progress));
  return amount * amount * amount * (amount * (amount * 6 - 15) + 10);
}

function smoothStepRange(start: number, end: number, progress: number): number {
  const amount = Math.max(0, Math.min(1, (progress - start) / Math.max(end - start, EPSILON)));
  return amount * amount * (3 - amount * 2);
}

function getSkillSupportGripWeight(progress: number, releaseStart: number): number {
  const acquire = smoothStepRange(0, 0.16, progress);
  const release = 1 - smoothStepRange(releaseStart, 1, progress);
  return Math.min(acquire, release);
}
