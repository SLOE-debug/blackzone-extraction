import {
  EquipmentCategory,
  EquipmentRarity,
  WeaponGrip,
  WeaponKind,
} from '../../../../../core/equipment/equipment';
import { type BattlefieldEquipmentPrototype } from '../../catalog/battlefield-equipment-prototype';
import { EquipmentId } from '../../catalog/equipment-id';
import { SLEDGEHAMMER_GEOMETRY } from './sledgehammer-geometry';

/** 大锤在战场中的完整玩法与可视原型。 */
export const SLEDGEHAMMER_PROTOTYPE = Object.freeze({
  id: EquipmentId.Sledgehammer,
  definition: Object.freeze({
    id: EquipmentId.Sledgehammer,
    category: EquipmentCategory.Weapon,
    displayName: '裂岩大锤',
    description: '沉重的单手战锤，连续命中可积蓄震势',
    rarity: EquipmentRarity.Epic,
    maximumStack: 1,
    kind: WeaponKind.Sledgehammer,
    baseDamage: 42,
    reach: 3.9,
    hitArcRadians: Math.PI * 0.74,
    attackIntervalSeconds: 0.72,
    knockbackImpulse: 8.4,
    comboWindowSeconds: 2.5,
    specialRequiredHits: 5,
  }),
  geometry: SLEDGEHAMMER_GEOMETRY,
  dropped: Object.freeze({ scale: 0.42, boundsRadius: 1.72 }),
  held: Object.freeze({
    grip: WeaponGrip.OneHandHeavy,
    heldScale: 0.45,
    originRightOffset: 0.03,
    originHeightOffset: 0.02,
    originForwardOffset: 0.02,
    rotationXDegrees: -4,
    rotationYDegrees: 0,
    rotationZDegrees: -8,
  }),
}) satisfies BattlefieldEquipmentPrototype<EquipmentId.Sledgehammer>;
