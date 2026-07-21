/** 战场装备原型清单使用的稳定标识。 */
export enum EquipmentId {
  DesertEagle = 'desert-eagle',
  PumpShotgun = 'pump-shotgun',
  KrissVector = 'kriss-vector',
  M4A1 = 'm4a1',
  Akm = 'akm',
  FiftyActionExpressAmmunition = '50-ae-ammunition',
  TwelveGaugeAmmunition = '12-gauge-ammunition',
  FortyFiveAcpAmmunition = '45-acp-ammunition',
  FiveFiveSixNatoAmmunition = '5.56-nato-ammunition',
  SevenSixTwoAmmunition = '7.62x39-ammunition',
}

/** 能够进入战场玩家唯一武器槽的装备标识。 */
export type WeaponEquipmentId =
  | EquipmentId.DesertEagle
  | EquipmentId.PumpShotgun
  | EquipmentId.KrissVector
  | EquipmentId.M4A1
  | EquipmentId.Akm;

/** 拾取后直接写入战场备用弹药库存的装备标识。 */
export type AmmunitionEquipmentId =
  | EquipmentId.FiftyActionExpressAmmunition
  | EquipmentId.TwelveGaugeAmmunition
  | EquipmentId.FortyFiveAcpAmmunition
  | EquipmentId.FiveFiveSixNatoAmmunition
  | EquipmentId.SevenSixTwoAmmunition;
