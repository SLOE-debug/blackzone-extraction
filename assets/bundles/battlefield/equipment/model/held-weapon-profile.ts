import { EquipmentId } from '../../../../core/equipment/equipment';
import { VanguardWeaponPose } from '../../../../player/vanguard/model/vanguard-weapon-pose';

/** 一种武器相对 WeaponAimRoot 的程序模型变换和真实攻击起点。 */
export interface HeldWeaponProfile {
  readonly equipmentId: EquipmentId;
  readonly pose: VanguardWeaponPose;
  readonly heldScale: number;
  readonly droppedScale: number;
  readonly originRightOffset: number;
  readonly originHeightOffset: number;
  readonly originForwardOffset: number;
  readonly rotationXDegrees: number;
  readonly rotationYDegrees: number;
  readonly rotationZDegrees: number;
}

/** 装备标识到完整手持视觉契约的强类型映射。 */
const HELD_WEAPON_PROFILES = Object.freeze({
  [EquipmentId.DesertEagle]: profile({
    equipmentId: EquipmentId.DesertEagle,
    pose: VanguardWeaponPose.Handgun,
    heldScale: 0.16,
    droppedScale: 0.34,
    originRightOffset: 0,
    originHeightOffset: 0.07,
    originForwardOffset: 0.09,
    rotationXDegrees: 0,
    rotationYDegrees: -90,
    rotationZDegrees: 0,
  }),
  [EquipmentId.PumpShotgun]: profile({
    equipmentId: EquipmentId.PumpShotgun,
    pose: VanguardWeaponPose.Shotgun,
    heldScale: 0.34,
    droppedScale: 0.28,
    originRightOffset: 0,
    originHeightOffset: 0.055,
    originForwardOffset: 0.045,
    rotationXDegrees: 0,
    rotationYDegrees: -90,
    rotationZDegrees: 0,
  }),
} satisfies Readonly<Record<EquipmentId, Readonly<HeldWeaponProfile>>>);

/** 返回指定装备不可变的手持视觉配置。 */
export function getHeldWeaponProfile(
  equipmentId: EquipmentId,
): Readonly<HeldWeaponProfile> {
  return HELD_WEAPON_PROFILES[equipmentId];
}

function profile(value: HeldWeaponProfile): Readonly<HeldWeaponProfile> {
  return Object.freeze(value);
}
