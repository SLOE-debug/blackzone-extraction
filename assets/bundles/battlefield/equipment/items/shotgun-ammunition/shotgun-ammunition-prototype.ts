import {
  AmmunitionType,
  EquipmentCategory,
  EquipmentRarity,
} from '../../../../../core/equipment/equipment';
import { SHOTGUN_AMMUNITION_GEOMETRY } from './shotgun-ammunition-geometry';
import {
  type BattlefieldAmmunitionPrototype,
} from '../../catalog/battlefield-equipment-prototype';
import { EquipmentId } from '../../catalog/equipment-id';

/** 霰弹枪弹药在战场中的完整玩法与可视原型。 */
export const SHOTGUN_AMMUNITION_PROTOTYPE = Object.freeze({
  id: EquipmentId.ShotgunAmmunition,
  definition: Object.freeze({
    id: EquipmentId.ShotgunAmmunition,
    category: EquipmentCategory.Ammunition,
    displayName: '霰弹枪弹药',
    description: '八发十二号霰弹枪备用弹',
    rarity: EquipmentRarity.Common,
    ammunitionType: AmmunitionType.ShotgunShell,
    rounds: 8,
  }),
  geometry: SHOTGUN_AMMUNITION_GEOMETRY,
  dropped: Object.freeze({ scale: 0.52 }),
}) satisfies BattlefieldAmmunitionPrototype<EquipmentId.ShotgunAmmunition>;
