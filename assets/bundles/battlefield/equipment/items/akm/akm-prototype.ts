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
import { type BattlefieldWeaponPrototype } from '../../catalog/battlefield-equipment-prototype';
import { EquipmentId } from '../../catalog/equipment-id';
import { AKM_GEOMETRY } from './akm-geometry';

/** AKM 在战场中的完整玩法与精细程序化原型。 */
export const AKM_PROTOTYPE = Object.freeze({
  id: EquipmentId.Akm,
  definition: Object.freeze({
    id: EquipmentId.Akm,
    category: EquipmentCategory.Weapon,
    displayName: 'AKM',
    description: '后坐沉重但单发强劲的 7.62×39 突击步枪',
    rarity: EquipmentRarity.Epic,
    weaponClass: WeaponClass.AssaultRifle,
    damage: 27,
    fireIntervalSeconds: 0.145,
    attackAnimationSeconds: 0.17,
    ammunition: Object.freeze({
      mode: WeaponAmmunitionMode.Magazine,
      ammunitionType: AmmunitionType.SevenSixTwoByThirtyNine,
      capacity: 30,
      reloadSeconds: 1.55,
      initialReserveRounds: 150,
    }),
    shotPattern: Object.freeze({ type: WeaponShotPatternType.Single }),
    projectile: Object.freeze({
      speed: 35,
      maximumRange: 24,
      impactRadius: 0.11,
      visual: WeaponProjectileVisual.Bullet,
    }),
  }),
  geometry: AKM_GEOMETRY,
  dropped: Object.freeze({ scale: 0.27 }),
  held: Object.freeze({
    grip: WeaponGrip.LongGun,
    heldScale: 0.3,
    originRightOffset: 0,
    originHeightOffset: 0.05,
    originForwardOffset: 0.055,
    muzzleRightOffset: 0,
    muzzleHeightOffset: 0.08,
    muzzleForwardOffset: 0.964,
    rotationXDegrees: 0,
    rotationYDegrees: -90,
    rotationZDegrees: 0,
  }),
}) satisfies BattlefieldWeaponPrototype<EquipmentId.Akm>;
