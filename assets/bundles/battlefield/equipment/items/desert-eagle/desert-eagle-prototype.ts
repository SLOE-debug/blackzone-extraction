import {
  AmmunitionType,
  EquipmentCategory,
  EquipmentRarity,
  WeaponAmmunitionMode,
  WeaponClass,
  WeaponGrip,
  WeaponProjectileVisual,
  WeaponShotPatternType,
} from '../../../../../core/equipment/equipment';
import { DESERT_EAGLE_GEOMETRY } from './desert-eagle-geometry';
import {
  type BattlefieldWeaponPrototype,
} from '../../catalog/battlefield-equipment-prototype';
import { EquipmentId } from '../../catalog/equipment-id';

/** 沙漠之鹰在战场中的完整玩法与可视原型。 */
export const DESERT_EAGLE_PROTOTYPE = Object.freeze({
  id: EquipmentId.DesertEagle,
  definition: Object.freeze({
    id: EquipmentId.DesertEagle,
    category: EquipmentCategory.Weapon,
    displayName: '沙漠之鹰',
    description: '稳定轻便的蓝色制式半自动手枪',
    rarity: EquipmentRarity.Rare,
    weaponClass: WeaponClass.Handgun,
    damage: 34,
    fireIntervalSeconds: 0.32,
    attackAnimationSeconds: 0.22,
    ammunition: Object.freeze({
      mode: WeaponAmmunitionMode.Magazine,
      ammunitionType: AmmunitionType.FiftyActionExpress,
      capacity: 8,
      reloadSeconds: 1.08,
      initialReserveRounds: 48,
    }),
    shotPattern: Object.freeze({
      type: WeaponShotPatternType.Single,
    }),
    projectile: Object.freeze({
      speed: 31,
      maximumRange: 20,
      impactRadius: 0.12,
      maximumHitCount: 1,
      damageRetention: 1,
      visual: WeaponProjectileVisual.Bullet,
    }),
  }),
  geometry: DESERT_EAGLE_GEOMETRY,
  dropped: Object.freeze({ scale: 0.34 }),
  held: Object.freeze({
    grip: WeaponGrip.Handgun,
    heldScale: 0.16,
    originRightOffset: 0,
    originHeightOffset: 0.07,
    originForwardOffset: 0.09,
    muzzleRightOffset: 0,
    muzzleHeightOffset: 0.103,
    muzzleForwardOffset: 0.35,
    rotationXDegrees: 0,
    rotationYDegrees: -90,
    rotationZDegrees: 0,
  }),
}) satisfies BattlefieldWeaponPrototype<EquipmentId.DesertEagle>;
