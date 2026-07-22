import {
  AmmunitionType,
  EquipmentCategory,
  EquipmentRarity,
} from '../../../../../core/equipment/equipment';
import { type BattlefieldAmmunitionPrototype } from '../../catalog/battlefield-equipment-prototype';
import { EquipmentId } from '../../catalog/equipment-id';
import { SEVEN_SIX_TWO_AMMUNITION_GEOMETRY } from './seven-six-two-ammunition-geometry';

/** 7.62×39 弹药在战场中的完整玩法与可视原型。 */
export const SEVEN_SIX_TWO_AMMUNITION_PROTOTYPE = Object.freeze({
  id: EquipmentId.SevenSixTwoAmmunition,
  definition: Object.freeze({
    id: EquipmentId.SevenSixTwoAmmunition,
    category: EquipmentCategory.Ammunition,
    displayName: '7.62×39',
    description: '九十发通用 7.62×39 备用弹',
    rarity: EquipmentRarity.Common,
    ammunitionType: AmmunitionType.SevenSixTwoByThirtyNine,
    rounds: 90,
  }),
  geometry: SEVEN_SIX_TWO_AMMUNITION_GEOMETRY,
  dropped: Object.freeze({ scale: 0.49 }),
}) satisfies BattlefieldAmmunitionPrototype<EquipmentId.SevenSixTwoAmmunition>;
