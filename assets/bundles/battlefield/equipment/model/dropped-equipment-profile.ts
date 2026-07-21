import { EquipmentId } from '../../../../core/equipment/equipment';

/** 一类世界掉落物相对其程序化几何的稳定展示尺度。 */
export interface DroppedEquipmentProfile {
  readonly equipmentId: EquipmentId;
  readonly scale: number;
}

/** 全部可掉落装备到世界展示尺度的完整映射。 */
const DROPPED_EQUIPMENT_PROFILES = Object.freeze({
  [EquipmentId.DesertEagle]: profile(EquipmentId.DesertEagle, 0.34),
  [EquipmentId.PumpShotgun]: profile(EquipmentId.PumpShotgun, 0.28),
  [EquipmentId.HandgunAmmunition]: profile(EquipmentId.HandgunAmmunition, 0.48),
  [EquipmentId.ShotgunAmmunition]: profile(EquipmentId.ShotgunAmmunition, 0.52),
} satisfies Readonly<Record<EquipmentId, Readonly<DroppedEquipmentProfile>>>);

/** 返回指定掉落装备不可变的世界展示配置。 */
export function getDroppedEquipmentProfile(
  equipmentId: EquipmentId,
): Readonly<DroppedEquipmentProfile> {
  return DROPPED_EQUIPMENT_PROFILES[equipmentId];
}

function profile(
  equipmentId: EquipmentId,
  scale: number,
): Readonly<DroppedEquipmentProfile> {
  return Object.freeze({ equipmentId, scale });
}
