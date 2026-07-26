import {
  type EquipmentLibrary,
  type MeleeWeaponDefinition,
} from '../../../../core/equipment/equipment';
import { EquipmentId } from './equipment-id';

/** 战场装备标识到精确定义类别的编译期映射。 */
export type BattlefieldEquipmentDefinitionById = {
  readonly [EquipmentId.Sledgehammer]: MeleeWeaponDefinition<EquipmentId.Sledgehammer>;
};

/** 战场玩法依赖的强类型装备定义查询门面。 */
export type BattlefieldEquipmentLibrary = EquipmentLibrary<
  EquipmentId,
  BattlefieldEquipmentDefinitionById
>;
