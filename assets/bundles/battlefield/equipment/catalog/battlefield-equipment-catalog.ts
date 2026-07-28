import { SLEDGEHAMMER_PROTOTYPE } from '../items/sledgehammer/sledgehammer-prototype';
import { RETURNING_BOW_PROTOTYPE } from '../items/returning-bow/returning-bow-prototype';
import {
  type BattlefieldEquipmentDefinitionById,
  type BattlefieldEquipmentLibrary,
} from './battlefield-equipment-contracts';
import {
  type BattlefieldEquipmentPrototypeById,
} from './battlefield-equipment-prototype';
import { EquipmentId } from './equipment-id';

/** 战场当前可生成装备的唯一强类型原型清单。 */
const BATTLEFIELD_EQUIPMENT_PROTOTYPES: BattlefieldEquipmentPrototypeById = Object.freeze({
  [EquipmentId.Sledgehammer]: SLEDGEHAMMER_PROTOTYPE,
  [EquipmentId.ReturningBow]: RETURNING_BOW_PROTOTYPE,
});

/** 返回指定装备拥有定义、几何和展示配置的完整原型。 */
export function getBattlefieldEquipmentPrototype<TId extends EquipmentId>(
  equipmentId: TId,
): Readonly<BattlefieldEquipmentPrototypeById[TId]> {
  return BATTLEFIELD_EQUIPMENT_PROTOTYPES[equipmentId];
}

/** 战场玩法共享的只读装备定义查询门面。 */
export const BATTLEFIELD_EQUIPMENT_LIBRARY: BattlefieldEquipmentLibrary = Object.freeze({
  get<TId extends EquipmentId>(
    equipmentId: TId,
  ): Readonly<BattlefieldEquipmentDefinitionById[TId]> {
    return BATTLEFIELD_EQUIPMENT_PROTOTYPES[equipmentId].definition;
  },
});
