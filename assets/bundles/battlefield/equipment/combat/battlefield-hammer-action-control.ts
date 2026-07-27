import { WeaponAction } from '../../../../core/equipment/equipment';
import { VanguardFacingPolicy } from '../../../../player/vanguard/model/vanguard-facing-policy';
import { SLEDGEHAMMER_PROGRESSION } from '../items/sledgehammer/sledgehammer-progression';

const DEGREES_TO_RADIANS = Math.PI / 180;

/** 单个大锤动作阶段对移动、朝向、锁敌和承伤的完整控制配置。 */
export interface HammerActionControlProfile {
  readonly movementScale: number;
  readonly facingPolicy: VanguardFacingPolicy;
  readonly maximumTurnSpeed: number;
  readonly autoTargetAllowed: boolean;
  readonly damageTakenScale: number;
}

const IDLE_CONTROL = createProfile(1, VanguardFacingPolicy.Free, 0, true, 1);
const WINDUP_CONTROL = createProfile(
  0.85,
  VanguardFacingPolicy.SoftTarget,
  540 * DEGREES_TO_RADIANS,
  true,
  1,
);
const SWING_CONTROL = createProfile(
  0.65,
  VanguardFacingPolicy.ContactLocked,
  120 * DEGREES_TO_RADIANS,
  false,
  1,
);
const CHAIN_PREPARE_CONTROL = createProfile(
  0.75,
  VanguardFacingPolicy.SoftTarget,
  720 * DEGREES_TO_RADIANS,
  true,
  1,
);
const RECOVER_EARLY_CONTROL = createProfile(
  0.75,
  VanguardFacingPolicy.ContactLocked,
  180 * DEGREES_TO_RADIANS,
  false,
  1,
);
const RECOVER_LATE_CONTROL = createProfile(
  0.95,
  VanguardFacingPolicy.Free,
  720 * DEGREES_TO_RADIANS,
  false,
  1,
);
const UPPERCUT_CONTROL = createProfile(
  0.45,
  VanguardFacingPolicy.ContactLocked,
  90 * DEGREES_TO_RADIANS,
  false,
  1,
);
const GROUND_SLAM_CONTROL = createProfile(
  0.35,
  VanguardFacingPolicy.ContactLocked,
  90 * DEGREES_TO_RADIANS,
  false,
  1,
);
const SPIN_CONTROL = createProfile(
  SLEDGEHAMMER_PROGRESSION.spinMovementScale,
  VanguardFacingPolicy.SpinDriven,
  0,
  false,
  SLEDGEHAMMER_PROGRESSION.spinDamageTakenScale,
);

/** 以当前动作和进度返回唯一控制配置，恢复后半会逐渐交还移动转向。 */
export function getHammerActionControlProfile(
  action: WeaponAction,
  progress: number,
): Readonly<HammerActionControlProfile> {
  switch (action) {
    case WeaponAction.Idle:
      return IDLE_CONTROL;
    case WeaponAction.WindupLeft:
    case WeaponAction.WindupRight:
      return WINDUP_CONTROL;
    case WeaponAction.SwingLeft:
    case WeaponAction.SwingRight:
      return SWING_CONTROL;
    case WeaponAction.ChainPrepareLeft:
    case WeaponAction.ChainPrepareRight:
      return CHAIN_PREPARE_CONTROL;
    case WeaponAction.Recover:
      return progress < 0.5 ? RECOVER_EARLY_CONTROL : RECOVER_LATE_CONTROL;
    case WeaponAction.Uppercut:
      return UPPERCUT_CONTROL;
    case WeaponAction.GroundSlam:
      return GROUND_SLAM_CONTROL;
    case WeaponAction.Spin:
      return SPIN_CONTROL;
  }
}

function createProfile(
  movementScale: number,
  facingPolicy: VanguardFacingPolicy,
  maximumTurnSpeed: number,
  autoTargetAllowed: boolean,
  damageTakenScale: number,
): Readonly<HammerActionControlProfile> {
  return Object.freeze({
    movementScale,
    facingPolicy,
    maximumTurnSpeed,
    autoTargetAllowed,
    damageTakenScale,
  });
}
