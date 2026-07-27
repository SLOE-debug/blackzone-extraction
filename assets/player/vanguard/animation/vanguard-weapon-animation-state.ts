import { damp } from '../../../core/math/scalar';
import { type VanguardData } from '../model/vanguard-schema';
import { VanguardWeaponAction } from '../model/vanguard-weapon-action';
import { VanguardWeaponPose } from '../model/vanguard-weapon-pose';

/** 姿态求解器单帧读取的连续武器动画状态。 */
export interface VanguardWeaponAnimationPoseState {
  chestYaw: number;
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
  leftElbowPoleX: -1.18,
  leftElbowPoleY: 2.38,
  leftElbowPoleZ: 0.72,
  rightElbowPoleX: 1.18,
  rightElbowPoleY: 2.38,
  rightElbowPoleZ: 0.72,
  mainGripWeight: 0,
  supportGripWeight: 0,
  hammerLag: 0,
}) satisfies Readonly<VanguardWeaponAnimationPoseState>;

/** 推进胸腔临界阻尼、肘部 Pole、双握点权重与锤体惯性滞后。 */
export function updateVanguardWeaponAnimationState(
  data: VanguardData,
  index: number,
  deltaTime: number,
): void {
  const action = data.intent.weaponAction[index] as VanguardWeaponAction;
  const progress = Math.max(0, Math.min(1, data.intent.weaponActionProgress[index] ?? 0));
  const side = getActionSide(action, (data.intent.weaponActionSide[index] ?? 0) as -1 | 0 | 1);
  const pulse = getActionPulse(action, progress);
  const weapon = data.weaponAnimation;
  const chestTarget = action === VanguardWeaponAction.Spin ? 0 : side * pulse * 0.5;
  updateCriticalSpring(
    weapon.chestYaw,
    weapon.chestYawVelocity,
    index,
    chestTarget,
    15,
    deltaTime,
  );

  const ready = (data.intent.weaponPose[index] as VanguardWeaponPose)
    === VanguardWeaponPose.TwoHandHeavy;
  weapon.mainGripWeight[index] = damp(
    weapon.mainGripWeight[index] ?? 0,
    ready ? 1 : 0,
    ready ? 20 : 15,
    deltaTime,
  );
  weapon.supportGripWeight[index] = damp(
    weapon.supportGripWeight[index] ?? 0,
    ready ? 1 : 0,
    ready ? 16 : 18,
    deltaTime,
  );

  const poleLateralShift = side * pulse * 0.22;
  const poleForwardShift = action === VanguardWeaponAction.GroundSlam
    ? -0.24 * Math.sin(progress * Math.PI)
    : action === VanguardWeaponAction.Uppercut
      ? 0.3 * Math.sin(progress * Math.PI)
      : 0;
  weapon.leftElbowPoleX[index] = damp(
    weapon.leftElbowPoleX[index] ?? -1.18,
    -1.18 + poleLateralShift,
    13,
    deltaTime,
  );
  weapon.leftElbowPoleY[index] = damp(
    weapon.leftElbowPoleY[index] ?? 2.38,
    2.38 - pulse * 0.08,
    13,
    deltaTime,
  );
  weapon.leftElbowPoleZ[index] = damp(
    weapon.leftElbowPoleZ[index] ?? 0.72,
    0.72 + poleForwardShift,
    13,
    deltaTime,
  );
  weapon.rightElbowPoleX[index] = damp(
    weapon.rightElbowPoleX[index] ?? 1.18,
    1.18 + poleLateralShift,
    13,
    deltaTime,
  );
  weapon.rightElbowPoleY[index] = damp(
    weapon.rightElbowPoleY[index] ?? 2.38,
    2.38 + pulse * 0.06,
    13,
    deltaTime,
  );
  weapon.rightElbowPoleZ[index] = damp(
    weapon.rightElbowPoleZ[index] ?? 0.72,
    0.72 + poleForwardShift,
    13,
    deltaTime,
  );

  const lagTarget = action === VanguardWeaponAction.Spin
    ? -0.12
    : -side * pulse * 0.1;
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
  result.leftElbowPoleX = source.leftElbowPoleX[index] ?? -1.18;
  result.leftElbowPoleY = source.leftElbowPoleY[index] ?? 2.38;
  result.leftElbowPoleZ = source.leftElbowPoleZ[index] ?? 0.72;
  result.rightElbowPoleX = source.rightElbowPoleX[index] ?? 1.18;
  result.rightElbowPoleY = source.rightElbowPoleY[index] ?? 2.38;
  result.rightElbowPoleZ = source.rightElbowPoleZ[index] ?? 0.72;
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

function getActionSide(
  action: VanguardWeaponAction,
  fallback: -1 | 0 | 1,
): -1 | 0 | 1 {
  switch (action) {
    case VanguardWeaponAction.WindupLeft:
    case VanguardWeaponAction.SwingLeft:
      return -1;
    case VanguardWeaponAction.WindupRight:
    case VanguardWeaponAction.SwingRight:
      return 1;
    case VanguardWeaponAction.Recover:
      return fallback;
    case VanguardWeaponAction.Idle:
    case VanguardWeaponAction.Uppercut:
    case VanguardWeaponAction.GroundSlam:
    case VanguardWeaponAction.Spin:
      return 0;
  }
}

function getActionPulse(action: VanguardWeaponAction, progress: number): number {
  switch (action) {
    case VanguardWeaponAction.WindupLeft:
    case VanguardWeaponAction.WindupRight:
      return progress;
    case VanguardWeaponAction.SwingLeft:
    case VanguardWeaponAction.SwingRight:
      return 1 - progress * 0.35;
    case VanguardWeaponAction.Uppercut:
    case VanguardWeaponAction.GroundSlam:
      return Math.sin(progress * Math.PI);
    case VanguardWeaponAction.Recover:
      return 1 - progress;
    case VanguardWeaponAction.Spin:
      return 0.72;
    case VanguardWeaponAction.Idle:
      return 0;
  }
}
