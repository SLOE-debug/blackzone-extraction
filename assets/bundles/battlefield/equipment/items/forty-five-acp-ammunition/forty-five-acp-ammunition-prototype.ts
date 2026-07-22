import {
  AmmunitionType,
  EquipmentCategory,
  EquipmentRarity,
} from '../../../../../core/equipment/equipment';
import { type BattlefieldAmmunitionPrototype } from '../../catalog/battlefield-equipment-prototype';
import { EquipmentId } from '../../catalog/equipment-id';
import { FORTY_FIVE_ACP_AMMUNITION_GEOMETRY } from './forty-five-acp-ammunition-geometry';

/** .45 ACP 弹药在战场中的完整玩法与可视原型。 */
export const FORTY_FIVE_ACP_AMMUNITION_PROTOTYPE = Object.freeze({
  id: EquipmentId.FortyFiveAcpAmmunition,
  definition: Object.freeze({
    id: EquipmentId.FortyFiveAcpAmmunition,
    category: EquipmentCategory.Ammunition,
    displayName: '.45 ACP',
    description: '九十发通用 .45 ACP 备用弹',
    rarity: EquipmentRarity.Common,
    ammunitionType: AmmunitionType.FortyFiveAcp,
    rounds: 90,
  }),
  geometry: FORTY_FIVE_ACP_AMMUNITION_GEOMETRY,
  dropped: Object.freeze({ scale: 0.48 }),
}) satisfies BattlefieldAmmunitionPrototype<EquipmentId.FortyFiveAcpAmmunition>;
