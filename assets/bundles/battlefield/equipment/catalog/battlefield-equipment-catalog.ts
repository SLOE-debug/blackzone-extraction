import { EquipmentCategory } from '../../../../core/equipment/equipment';
import { DESERT_EAGLE_PROTOTYPE } from '../items/desert-eagle/desert-eagle-prototype';
import { AKM_PROTOTYPE } from '../items/akm/akm-prototype';
import {
  FIVE_FIVE_SIX_NATO_AMMUNITION_PROTOTYPE,
} from '../items/five-five-six-nato-ammunition/five-five-six-nato-ammunition-prototype';
import {
  FORTY_FIVE_ACP_AMMUNITION_PROTOTYPE,
} from '../items/forty-five-acp-ammunition/forty-five-acp-ammunition-prototype';
import {
  FIFTY_ACTION_EXPRESS_AMMUNITION_PROTOTYPE,
} from '../items/handgun-ammunition/handgun-ammunition-prototype';
import { PUMP_SHOTGUN_PROTOTYPE } from '../items/pump-shotgun/pump-shotgun-prototype';
import { KRISS_VECTOR_PROTOTYPE } from '../items/kriss-vector/kriss-vector-prototype';
import { M4A1_PROTOTYPE } from '../items/m4a1/m4a1-prototype';
import {
  SEVEN_SIX_TWO_AMMUNITION_PROTOTYPE,
} from '../items/seven-six-two-ammunition/seven-six-two-ammunition-prototype';
import {
  TWELVE_GAUGE_AMMUNITION_PROTOTYPE,
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
  [EquipmentId.KrissVector]: KRISS_VECTOR_PROTOTYPE,
  [EquipmentId.M4A1]: M4A1_PROTOTYPE,
  [EquipmentId.Akm]: AKM_PROTOTYPE,
  [EquipmentId.FiftyActionExpressAmmunition]: FIFTY_ACTION_EXPRESS_AMMUNITION_PROTOTYPE,
  [EquipmentId.TwelveGaugeAmmunition]: TWELVE_GAUGE_AMMUNITION_PROTOTYPE,
  [EquipmentId.FortyFiveAcpAmmunition]: FORTY_FIVE_ACP_AMMUNITION_PROTOTYPE,
  [EquipmentId.FiveFiveSixNatoAmmunition]: FIVE_FIVE_SIX_NATO_AMMUNITION_PROTOTYPE,
  [EquipmentId.SevenSixTwoAmmunition]: SEVEN_SIX_TWO_AMMUNITION_PROTOTYPE,
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
