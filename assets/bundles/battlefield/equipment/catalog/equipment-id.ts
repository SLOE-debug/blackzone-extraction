/** 战场装备原型清单使用的稳定标识。 */
export enum EquipmentId {
  DesertEagle = 'desert-eagle',
  PumpShotgun = 'pump-shotgun',
  HandgunAmmunition = 'handgun-ammunition',
  ShotgunAmmunition = 'shotgun-ammunition',
}

/** 能够进入战场玩家唯一武器槽的装备标识。 */
export type WeaponEquipmentId =
  | EquipmentId.DesertEagle
  | EquipmentId.PumpShotgun;

/** 拾取后直接写入战场备用弹药库存的装备标识。 */
export type AmmunitionEquipmentId =
  | EquipmentId.HandgunAmmunition
  | EquipmentId.ShotgunAmmunition;
