import {
  AmmunitionType,
  EquipmentCategory,
  EquipmentRarity,
} from '../../../../../core/equipment/equipment';
import { type BattlefieldAmmunitionPrototype } from '../../catalog/battlefield-equipment-prototype';
import { EquipmentId } from '../../catalog/equipment-id';
import { FIVE_FIVE_SIX_NATO_AMMUNITION_GEOMETRY } from './five-five-six-nato-ammunition-geometry';

/** 5.56×45 NATO 弹药在战场中的完整玩法与可视原型。 */
export const FIVE_FIVE_SIX_NATO_AMMUNITION_PROTOTYPE = Object.freeze({
  id: EquipmentId.FiveFiveSixNatoAmmunition,
  definition: Object.freeze({
    id: EquipmentId.FiveFiveSixNatoAmmunition,
    category: EquipmentCategory.Ammunition,
    displayName: '5.56×45 NATO',
    description: '一百二十发通用 5.56×45 NATO 备用弹',
    rarity: EquipmentRarity.Common,
    ammunitionType: AmmunitionType.FiveFiveSixNato,
    rounds: 120,
  }),
  geometry: FIVE_FIVE_SIX_NATO_AMMUNITION_GEOMETRY,
  dropped: Object.freeze({ scale: 0.47 }),
}) satisfies BattlefieldAmmunitionPrototype<EquipmentId.FiveFiveSixNatoAmmunition>;
