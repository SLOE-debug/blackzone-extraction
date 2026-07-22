import {
  AmmunitionType,
  EquipmentCategory,
  EquipmentRarity,
} from '../../../../../core/equipment/equipment';
import { TWELVE_GAUGE_AMMUNITION_GEOMETRY } from './shotgun-ammunition-geometry';
import {
  type BattlefieldAmmunitionPrototype,
} from '../../catalog/battlefield-equipment-prototype';
import { EquipmentId } from '../../catalog/equipment-id';

/** 12 Gauge 霰弹在战场中的完整玩法与可视原型。 */
export const TWELVE_GAUGE_AMMUNITION_PROTOTYPE = Object.freeze({
  id: EquipmentId.TwelveGaugeAmmunition,
  definition: Object.freeze({
    id: EquipmentId.TwelveGaugeAmmunition,
    category: EquipmentCategory.Ammunition,
    displayName: '12 Gauge',
    description: '二十四发十二号霰弹枪备用弹',
    rarity: EquipmentRarity.Common,
    ammunitionType: AmmunitionType.TwelveGauge,
    rounds: 24,
  }),
  geometry: TWELVE_GAUGE_AMMUNITION_GEOMETRY,
  dropped: Object.freeze({ scale: 0.52 }),
}) satisfies BattlefieldAmmunitionPrototype<EquipmentId.TwelveGaugeAmmunition>;
