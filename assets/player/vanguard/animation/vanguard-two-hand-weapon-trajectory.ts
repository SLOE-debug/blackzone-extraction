import { VanguardWeaponAction } from '../model/vanguard-weapon-action';
import {
  copyVanguardWeaponTrajectoryPose,
  createVanguardWeaponTrajectoryKeyframe,
  createVanguardWeaponTrajectoryVelocity,
  createZeroVanguardWeaponTrajectoryVelocity,
  interpolateVanguardWeaponTrajectoryPose,
  type VanguardWeaponTrajectoryKeyframe,
  writeVanguardWeaponHermitePose,
} from './vanguard-weapon-trajectory-interpolation';

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

const SWING_WINDUP_SECONDS = 0.28;
const SWING_CONTACT_SECONDS = 0.34;
const CHAIN_PREPARE_SECONDS = 0.12;
const RECOVER_SECONDS = 0.1;

const IDLE_POSE = createVanguardWeaponTrajectoryKeyframe(
  0.58, 1.68, 0.26,
  0.18, -0.96, 0.22,
  0, 0,
  -1.34, 2.3, 0.82,
  1.34, 2.3, 0.82,
  0,
);
const LEFT_WINDUP_POSE = createVanguardWeaponTrajectoryKeyframe(
  -0.08, 2.18, 0.62,
  0.7, -0.1, 0.71,
  -0.2, -0.09,
  -1.8, 2.42, 1.08,
  1.76, 2.4, 1.04,
  1,
);
const LEFT_FOLLOW_THROUGH_POSE = createVanguardWeaponTrajectoryKeyframe(
  -0.08, 2.2, 0.76,
  -0.7, -0.08, 0.71,
  0.14, 0.07,
  -1.76, 2.38, 1.05,
  1.8, 2.42, 1.1,
  1,
);
const RIGHT_WINDUP_POSE = createVanguardWeaponTrajectoryKeyframe(
  0.08, 2.18, 0.62,
  -0.7, -0.1, 0.71,
  0.2, 0.09,
  -1.76, 2.4, 1.04,
  1.8, 2.42, 1.08,
  1,
);
const RIGHT_FOLLOW_THROUGH_POSE = createVanguardWeaponTrajectoryKeyframe(
  0.08, 2.2, 0.76,
  0.7, -0.08, 0.71,
  -0.14, -0.07,
  -1.8, 2.42, 1.1,
  1.76, 2.38, 1.05,
  1,
);
const UPPERCUT_APEX_POSE = createVanguardWeaponTrajectoryKeyframe(
  0, 2.18, 0.74,
  0, 0.68, 0.74,
  0, 0,
  -1.82, 2.5, 1.14,
  1.82, 2.5, 1.14,
  1,
);
const GROUND_SLAM_RAISED_POSE = createVanguardWeaponTrajectoryKeyframe(
  0, 2.52, 0.68,
  0, 0.74, -0.68,
  0, 0,
  -1.82, 2.55, 0.96,
  1.82, 2.55, 0.96,
  1,
);
const GROUND_SLAM_IMPACT_POSE = createVanguardWeaponTrajectoryKeyframe(
  0, 2.15, 0.75,
  0, -0.96, 0.28,
  0, 0,
  -1.8, 2.24, 1.12,
  1.8, 2.24, 1.12,
  1,
);
const SPIN_POSE = createVanguardWeaponTrajectoryKeyframe(
  0, 2.2, 0.72,
  0.98, -0.12, 0.16,
  0, 0,
  -1.82, 2.4, 1.08,
  1.82, 2.4, 1.08,
  1,
);
const IDLE_VELOCITY = createZeroVanguardWeaponTrajectoryVelocity();
const LOOP_TANGENT_SPAN_SECONDS = SWING_CONTACT_SECONDS + CHAIN_PREPARE_SECONDS;
const LEFT_WINDUP_VELOCITY = createVanguardWeaponTrajectoryVelocity(
  RIGHT_FOLLOW_THROUGH_POSE,
  LEFT_FOLLOW_THROUGH_POSE,
  LOOP_TANGENT_SPAN_SECONDS,
);
const LEFT_FOLLOW_THROUGH_VELOCITY = createVanguardWeaponTrajectoryVelocity(
  LEFT_WINDUP_POSE,
  RIGHT_WINDUP_POSE,
  LOOP_TANGENT_SPAN_SECONDS,
);
const RIGHT_WINDUP_VELOCITY = createVanguardWeaponTrajectoryVelocity(
  LEFT_FOLLOW_THROUGH_POSE,
  RIGHT_FOLLOW_THROUGH_POSE,
  LOOP_TANGENT_SPAN_SECONDS,
);
const RIGHT_FOLLOW_THROUGH_VELOCITY = createVanguardWeaponTrajectoryVelocity(
  RIGHT_WINDUP_POSE,
  LEFT_WINDUP_POSE,
  LOOP_TANGENT_SPAN_SECONDS,
);

/** 创建供动画系统跨帧复用的完整轨迹输出。 */
export function createVanguardTwoHandWeaponTrajectoryPose(): VanguardTwoHandWeaponTrajectoryPose {
  return { ...IDLE_POSE };
}

/**
 * 按动作时间轴写出主握点、锤杆、躯干、双肘和副手参与度。
 *
 * 普通横扫以每秒共享切线连接首次蓄力、左右随挥、连段准备与最终恢复。
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
      writeVanguardWeaponHermitePose(
        result,
        IDLE_POSE,
        LEFT_WINDUP_POSE,
        IDLE_VELOCITY,
        LEFT_WINDUP_VELOCITY,
        SWING_WINDUP_SECONDS,
        amount,
      );
      break;
    case VanguardWeaponAction.WindupRight:
      writeVanguardWeaponHermitePose(
        result,
        IDLE_POSE,
        RIGHT_WINDUP_POSE,
        IDLE_VELOCITY,
        RIGHT_WINDUP_VELOCITY,
        SWING_WINDUP_SECONDS,
        amount,
      );
      break;
    case VanguardWeaponAction.SwingLeft:
      writeVanguardWeaponHermitePose(
        result,
        LEFT_WINDUP_POSE,
        LEFT_FOLLOW_THROUGH_POSE,
        LEFT_WINDUP_VELOCITY,
        LEFT_FOLLOW_THROUGH_VELOCITY,
        SWING_CONTACT_SECONDS,
        amount,
      );
      break;
    case VanguardWeaponAction.SwingRight:
      writeVanguardWeaponHermitePose(
        result,
        RIGHT_WINDUP_POSE,
        RIGHT_FOLLOW_THROUGH_POSE,
        RIGHT_WINDUP_VELOCITY,
        RIGHT_FOLLOW_THROUGH_VELOCITY,
        SWING_CONTACT_SECONDS,
        amount,
      );
      break;
    case VanguardWeaponAction.ChainPrepareLeft:
      writeVanguardWeaponHermitePose(
        result,
        RIGHT_FOLLOW_THROUGH_POSE,
        LEFT_WINDUP_POSE,
        RIGHT_FOLLOW_THROUGH_VELOCITY,
        LEFT_WINDUP_VELOCITY,
        CHAIN_PREPARE_SECONDS,
        amount,
      );
      break;
    case VanguardWeaponAction.ChainPrepareRight:
      writeVanguardWeaponHermitePose(
        result,
        LEFT_FOLLOW_THROUGH_POSE,
        RIGHT_WINDUP_POSE,
        LEFT_FOLLOW_THROUGH_VELOCITY,
        RIGHT_WINDUP_VELOCITY,
        CHAIN_PREPARE_SECONDS,
        amount,
      );
      break;
    case VanguardWeaponAction.Recover: {
      const start = recoverSide < 0
        ? LEFT_FOLLOW_THROUGH_POSE
        : RIGHT_FOLLOW_THROUGH_POSE;
      const startVelocity = recoverSide < 0
        ? LEFT_FOLLOW_THROUGH_VELOCITY
        : RIGHT_FOLLOW_THROUGH_VELOCITY;
      writeVanguardWeaponHermitePose(
        result,
        start,
        IDLE_POSE,
        startVelocity,
        IDLE_VELOCITY,
        RECOVER_SECONDS,
        amount,
      );
      break;
    }
    case VanguardWeaponAction.Uppercut:
      writeRoundTripPose(result, IDLE_POSE, UPPERCUT_APEX_POSE, amount, 0.55);
      result.supportGripWeight = getSkillSupportGripWeight(amount, 0.82);
      break;
    case VanguardWeaponAction.GroundSlam:
      if (amount < 0.42) {
        interpolateVanguardWeaponTrajectoryPose(
          result,
          IDLE_POSE,
          GROUND_SLAM_RAISED_POSE,
          smootherStep(amount / 0.42),
        );
      } else if (amount < 0.74) {
        interpolateVanguardWeaponTrajectoryPose(
          result,
          GROUND_SLAM_RAISED_POSE,
          GROUND_SLAM_IMPACT_POSE,
          smootherStep((amount - 0.42) / 0.32),
        );
      } else {
        interpolateVanguardWeaponTrajectoryPose(
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
        interpolateVanguardWeaponTrajectoryPose(
          result,
          IDLE_POSE,
          SPIN_POSE,
          smootherStep(amount / 0.08),
        );
      } else if (amount > 0.92) {
        interpolateVanguardWeaponTrajectoryPose(
          result,
          SPIN_POSE,
          IDLE_POSE,
          smootherStep((amount - 0.92) / 0.08),
        );
      } else {
        copyVanguardWeaponTrajectoryPose(result, SPIN_POSE);
      }
      result.supportGripWeight = getSkillSupportGripWeight(amount, 0.92);
      break;
    case VanguardWeaponAction.Idle:
      copyVanguardWeaponTrajectoryPose(result, IDLE_POSE);
      break;
  }
  rotateAndNormalizeShaft(result, yawLag);
}

function writeRoundTripPose(
  result: VanguardTwoHandWeaponTrajectoryPose,
  start: VanguardWeaponTrajectoryKeyframe,
  apex: VanguardWeaponTrajectoryKeyframe,
  progress: number,
  apexProgress: number,
): void {
  if (progress < apexProgress) {
    interpolateVanguardWeaponTrajectoryPose(
      result,
      start,
      apex,
      smootherStep(progress / apexProgress),
    );
  } else {
    interpolateVanguardWeaponTrajectoryPose(
      result,
      apex,
      start,
      smootherStep((progress - apexProgress) / (1 - apexProgress)),
    );
  }
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
