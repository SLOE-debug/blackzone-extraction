import { EquipmentCategory } from '../../../../core/equipment/equipment';
import { DESERT_EAGLE_PROTOTYPE } from '../items/desert-eagle/desert-eagle-prototype';
import {
  HANDGUN_AMMUNITION_PROTOTYPE,
} from '../items/handgun-ammunition/handgun-ammunition-prototype';
import { PUMP_SHOTGUN_PROTOTYPE } from '../items/pump-shotgun/pump-shotgun-prototype';
import {
  SHOTGUN_AMMUNITION_PROTOTYPE,
} from '../items/shotgun-ammunition/shotgun-ammunition-prototype';
import {
  type BattlefieldEquipmentDefinitionById,
  type BattlefieldEquipmentLibrary,
} from './battlefield-equipment-contracts';
import {
  type BattlefieldEquipmentPrototypeById,
  type BattlefieldWeaponPrototype,
} from './battlefield-equipment-prototype';
import {
  EquipmentId,
  type WeaponEquipmentId,
} from './equipment-id';

/** 战场当前可生成装备的唯一强类型原型清单。 */
const BATTLEFIELD_EQUIPMENT_PROTOTYPES: BattlefieldEquipmentPrototypeById = Object.freeze({
  [EquipmentId.DesertEagle]: DESERT_EAGLE_PROTOTYPE,
  [EquipmentId.PumpShotgun]: PUMP_SHOTGUN_PROTOTYPE,
  [EquipmentId.HandgunAmmunition]: HANDGUN_AMMUNITION_PROTOTYPE,
  [EquipmentId.ShotgunAmmunition]: SHOTGUN_AMMUNITION_PROTOTYPE,
});

/** 返回指定装备拥有定义、几何和展示配置的完整原型。 */
export function getBattlefieldEquipmentPrototype<TId extends EquipmentId>(
  equipmentId: TId,
): Readonly<BattlefieldEquipmentPrototypeById[TId]> {
  return BATTLEFIELD_EQUIPMENT_PROTOTYPES[equipmentId];
}

/** 返回指定武器包含中立握持配置的完整原型。 */
export function getBattlefieldWeaponPrototype<TId extends WeaponEquipmentId>(
  equipmentId: TId,
): Readonly<BattlefieldWeaponPrototype<TId>> {
  const prototype = BATTLEFIELD_EQUIPMENT_PROTOTYPES[equipmentId];
  if (prototype.definition.category !== EquipmentCategory.Weapon) {
    throw new Error(`战场装备不是武器：${equipmentId}。`);
  }
  return prototype;
}

/** 战场玩法共享的只读装备定义查询门面。 */
export const BATTLEFIELD_EQUIPMENT_LIBRARY: BattlefieldEquipmentLibrary = Object.freeze({
  get<TId extends EquipmentId>(
    equipmentId: TId,
  ): Readonly<BattlefieldEquipmentDefinitionById[TId]> {
    return BATTLEFIELD_EQUIPMENT_PROTOTYPES[equipmentId].definition;
  },
});
