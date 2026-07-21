import {
  AmmunitionType,
  EquipmentCategory,
  EquipmentRarity,
} from '../../../../../core/equipment/equipment';
import { HANDGUN_AMMUNITION_GEOMETRY } from './handgun-ammunition-geometry';
import {
  type BattlefieldAmmunitionPrototype,
} from '../../catalog/battlefield-equipment-prototype';
import { EquipmentId } from '../../catalog/equipment-id';

/** 手枪弹药在战场中的完整玩法与可视原型。 */
export const HANDGUN_AMMUNITION_PROTOTYPE = Object.freeze({
  id: EquipmentId.HandgunAmmunition,
  definition: Object.freeze({
    id: EquipmentId.HandgunAmmunition,
    category: EquipmentCategory.Ammunition,
    displayName: '手枪弹药',
    description: '十八发制式手枪备用弹',
    rarity: EquipmentRarity.Common,
    ammunitionType: AmmunitionType.HandgunRound,
    rounds: 18,
  }),
  geometry: HANDGUN_AMMUNITION_GEOMETRY,
  dropped: Object.freeze({ scale: 0.48 }),
}) satisfies BattlefieldAmmunitionPrototype<EquipmentId.HandgunAmmunition>;
