import {
  AmmunitionType,
  EquipmentCategory,
  EquipmentRarity,
} from '../../../../../core/equipment/equipment';
import {
  FIFTY_ACTION_EXPRESS_AMMUNITION_GEOMETRY,
} from './handgun-ammunition-geometry';
import {
  type BattlefieldAmmunitionPrototype,
} from '../../catalog/battlefield-equipment-prototype';
import { EquipmentId } from '../../catalog/equipment-id';

/** .50 Action Express 弹药在战场中的完整玩法与可视原型。 */
export const FIFTY_ACTION_EXPRESS_AMMUNITION_PROTOTYPE = Object.freeze({
  id: EquipmentId.FiftyActionExpressAmmunition,
  definition: Object.freeze({
    id: EquipmentId.FiftyActionExpressAmmunition,
    category: EquipmentCategory.Ammunition,
    displayName: '.50 AE',
    description: '三十二发大威力 .50 Action Express 备用弹',
    rarity: EquipmentRarity.Common,
    ammunitionType: AmmunitionType.FiftyActionExpress,
    rounds: 32,
  }),
  geometry: FIFTY_ACTION_EXPRESS_AMMUNITION_GEOMETRY,
  dropped: Object.freeze({ scale: 0.48 }),
}) satisfies BattlefieldAmmunitionPrototype<EquipmentId.FiftyActionExpressAmmunition>;
