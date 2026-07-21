import {
  WeaponAction,
  WeaponGrip,
} from '../../../core/equipment/equipment';
import { VanguardWeaponAction } from '../../../player/vanguard/model/vanguard-weapon-action';
import { VanguardWeaponPose } from '../../../player/vanguard/model/vanguard-weapon-pose';

const VANGUARD_POSE_BY_GRIP = Object.freeze({
  [WeaponGrip.Handgun]: VanguardWeaponPose.Handgun,
  [WeaponGrip.LongGun]: VanguardWeaponPose.Shotgun,
}) satisfies Readonly<Record<WeaponGrip, VanguardWeaponPose>>;

const VANGUARD_ACTION_BY_WEAPON_ACTION = Object.freeze({
  [WeaponAction.Ready]: VanguardWeaponAction.Ready,
  [WeaponAction.Fire]: VanguardWeaponAction.Fire,
  [WeaponAction.Reload]: VanguardWeaponAction.Reload,
}) satisfies Readonly<Record<WeaponAction, VanguardWeaponAction>>;

/** 把中立武器握持方式适配为 Vanguard 自身的动画姿态。 */
export function toVanguardWeaponPose(grip: WeaponGrip | null): VanguardWeaponPose {
  return grip === null ? VanguardWeaponPose.Unarmed : VANGUARD_POSE_BY_GRIP[grip];
}

/** 把中立武器动作适配为 Vanguard 自身的动画动作。 */
export function toVanguardWeaponAction(action: WeaponAction): VanguardWeaponAction {
  return VANGUARD_ACTION_BY_WEAPON_ACTION[action];
}
