import {
  type AmmunitionEquipmentDefinition,
  type EquipmentLibrary,
  type WeaponEquipmentDefinition,
} from '../../../../core/equipment/equipment';
import {
  type AmmunitionEquipmentId,
  EquipmentId,
  type WeaponEquipmentId,
} from './equipment-id';

/** 战场装备标识到精确定义类别的编译期映射。 */
export type BattlefieldEquipmentDefinitionById = {
  readonly [TId in WeaponEquipmentId]: WeaponEquipmentDefinition<TId>;
} & {
  readonly [TId in AmmunitionEquipmentId]: AmmunitionEquipmentDefinition<TId>;
};

/** 战场玩法依赖的强类型装备定义查询门面。 */
export type BattlefieldEquipmentLibrary = EquipmentLibrary<
  EquipmentId,
  BattlefieldEquipmentDefinitionById
>;
