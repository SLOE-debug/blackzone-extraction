/** 战场装备原型清单使用的稳定标识。 */
export enum EquipmentId {
  Sledgehammer = 'sledgehammer',
  ReturningBow = 'returning-bow',
}

/** 能够进入战场玩家武器行为运行时的装备标识。 */
export type WeaponEquipmentId = EquipmentId.Sledgehammer | EquipmentId.ReturningBow;
