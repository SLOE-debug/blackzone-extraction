import { damp } from '../../../core/math/scalar';
import { type VanguardData } from '../model/vanguard-schema';
import { VanguardWeaponAction } from '../model/vanguard-weapon-action';
import { VanguardWeaponPose } from '../model/vanguard-weapon-pose';
import { type VanguardTwoHandWeaponTrajectoryPose } from './vanguard-two-hand-weapon-trajectory';

/** 姿态求解器单帧读取的连续武器动画状态。 */
export interface VanguardWeaponAnimationPoseState {
  chestYaw: number;
  pelvisYaw: number;
  leftElbowPoleX: number;
  leftElbowPoleY: number;
  leftElbowPoleZ: number;
  rightElbowPoleX: number;
  rightElbowPoleY: number;
  rightElbowPoleZ: number;
  mainGripWeight: number;
  supportGripWeight: number;
  hammerLag: number;
}

/** 供绑定姿态计算使用的静止武器动画状态。 */
export const VANGUARD_WEAPON_ANIMATION_REST_STATE = Object.freeze({
  chestYaw: 0,
  pelvisYaw: 0,
  leftElbowPoleX: -1.34,
  leftElbowPoleY: 2.3,
  leftElbowPoleZ: 0.82,
  rightElbowPoleX: 1.34,
  rightElbowPoleY: 2.3,
  rightElbowPoleZ: 0.82,
  mainGripWeight: 0,
  supportGripWeight: 0,
  hammerLag: 0,
}) satisfies Readonly<VanguardWeaponAnimationPoseState>;

/** 推进胸腔临界阻尼、肘部 Pole、双握点权重与锤体惯性滞后。 */
export function updateVanguardWeaponAnimationState(
  data: VanguardData,
  index: number,
  deltaTime: number,
  trajectory: Readonly<VanguardTwoHandWeaponTrajectoryPose>,
): void {
  const action = data.intent.weaponAction[index] as VanguardWeaponAction;
  const weapon = data.weaponAnimation;
  updateCriticalSpring(
    weapon.chestYaw,
    weapon.chestYawVelocity,
    index,
    trajectory.chestYaw,
    15,
    deltaTime,
  );
  updateCriticalSpring(
    weapon.pelvisYaw,
    weapon.pelvisYawVelocity,
    index,
    trajectory.pelvisYaw,
    13,
    deltaTime,
  );

  const requestedPose = data.intent.weaponPose[index] as VanguardWeaponPose;
  const ready = requestedPose === VanguardWeaponPose.TwoHandHeavy
    || requestedPose === VanguardWeaponPose.TwoHandRanged;
  weapon.mainGripWeight[index] = damp(
    weapon.mainGripWeight[index] ?? 0,
    ready ? 1 : 0,
    ready ? 20 : 15,
    deltaTime,
  );
  weapon.supportGripWeight[index] = damp(
    weapon.supportGripWeight[index] ?? 0,
    ready ? trajectory.supportGripWeight : 0,
    trajectory.supportGripWeight > (weapon.supportGripWeight[index] ?? 0) ? 20 : 18,
    deltaTime,
  );

  weapon.leftElbowPoleX[index] = damp(
    weapon.leftElbowPoleX[index] ?? -1.34,
    trajectory.leftElbowPoleX,
    13,
    deltaTime,
  );
  weapon.leftElbowPoleY[index] = damp(
    weapon.leftElbowPoleY[index] ?? 2.3,
    trajectory.leftElbowPoleY,
    13,
    deltaTime,
  );
  weapon.leftElbowPoleZ[index] = damp(
    weapon.leftElbowPoleZ[index] ?? 0.82,
    trajectory.leftElbowPoleZ,
    13,
    deltaTime,
  );
  weapon.rightElbowPoleX[index] = damp(
    weapon.rightElbowPoleX[index] ?? 1.34,
    trajectory.rightElbowPoleX,
    13,
    deltaTime,
  );
  weapon.rightElbowPoleY[index] = damp(
    weapon.rightElbowPoleY[index] ?? 2.3,
    trajectory.rightElbowPoleY,
    13,
    deltaTime,
  );
  weapon.rightElbowPoleZ[index] = damp(
    weapon.rightElbowPoleZ[index] ?? 0.82,
    trajectory.rightElbowPoleZ,
    13,
    deltaTime,
  );

  const lagTarget = action === VanguardWeaponAction.Spin
    ? -0.12
    : -trajectory.chestYaw * 0.24;
  updateCriticalSpring(
    weapon.hammerLag,
    weapon.hammerLagVelocity,
    index,
    ready ? lagTarget : 0,
    11,
    deltaTime,
  );
}

/** 把指定实体的连续 SoA 字段复制到调用方复用对象。 */
export function writeVanguardWeaponAnimationPoseState(
  data: VanguardData,
  index: number,
  result: VanguardWeaponAnimationPoseState,
): void {
  const source = data.weaponAnimation;
  result.chestYaw = source.chestYaw[index] ?? 0;
  result.pelvisYaw = source.pelvisYaw[index] ?? 0;
  result.leftElbowPoleX = source.leftElbowPoleX[index] ?? -1.34;
  result.leftElbowPoleY = source.leftElbowPoleY[index] ?? 2.3;
  result.leftElbowPoleZ = source.leftElbowPoleZ[index] ?? 0.82;
  result.rightElbowPoleX = source.rightElbowPoleX[index] ?? 1.34;
  result.rightElbowPoleY = source.rightElbowPoleY[index] ?? 2.3;
  result.rightElbowPoleZ = source.rightElbowPoleZ[index] ?? 0.82;
  result.mainGripWeight = source.mainGripWeight[index] ?? 0;
  result.supportGripWeight = source.supportGripWeight[index] ?? 0;
  result.hammerLag = source.hammerLag[index] ?? 0;
}

function updateCriticalSpring(
  values: Float32Array,
  velocities: Float32Array,
  index: number,
  target: number,
  angularFrequency: number,
  deltaTime: number,
): void {
  const value = values[index] ?? 0;
  const velocity = velocities[index] ?? 0;
  const frequencyStep = angularFrequency * deltaTime;
  const denominator = 1 + 2 * frequencyStep + frequencyStep * frequencyStep;
  values[index] = (
    value * (1 + 2 * frequencyStep)
      + velocity * deltaTime
      + target * frequencyStep * frequencyStep
  ) / denominator;
  velocities[index] = (
    velocity + angularFrequency * angularFrequency * deltaTime * (target - value)
  ) / denominator;
}
