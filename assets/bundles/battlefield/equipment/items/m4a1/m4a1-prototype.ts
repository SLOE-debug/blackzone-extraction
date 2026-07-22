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
import { M4A1_GEOMETRY } from './m4a1-geometry';

/** M4A1 在战场中的完整玩法与精细程序化原型。 */
export const M4A1_PROTOTYPE = Object.freeze({
  id: EquipmentId.M4A1,
  definition: Object.freeze({
    id: EquipmentId.M4A1,
    category: EquipmentCategory.Weapon,
    displayName: 'M4A1',
    description: '稳定均衡的 5.56×45 NATO 制式突击步枪',
    rarity: EquipmentRarity.Rare,
    weaponClass: WeaponClass.AssaultRifle,
    damage: 26,
    fireIntervalSeconds: 0.105,
    attackAnimationSeconds: 0.13,
    ammunition: Object.freeze({
      mode: WeaponAmmunitionMode.Magazine,
      ammunitionType: AmmunitionType.FiveFiveSixNato,
      capacity: 30,
      reloadSeconds: 1.38,
      initialReserveRounds: 180,
    }),
    shotPattern: Object.freeze({ type: WeaponShotPatternType.Single }),
    projectile: Object.freeze({
      speed: 38,
      maximumRange: 25,
      impactRadius: 0.095,
      maximumHitCount: 3,
      damageRetention: 0.72,
      visual: WeaponProjectileVisual.Bullet,
    }),
  }),
  geometry: M4A1_GEOMETRY,
  dropped: Object.freeze({ scale: 0.27 }),
  held: Object.freeze({
    grip: WeaponGrip.LongGun,
    heldScale: 0.31,
    originRightOffset: 0,
    originHeightOffset: 0.05,
    originForwardOffset: 0.06,
    muzzleRightOffset: 0,
    muzzleHeightOffset: 0.113,
    muzzleForwardOffset: 0.978,
    rotationXDegrees: 0,
    rotationYDegrees: -90,
    rotationZDegrees: 0,
  }),
}) satisfies BattlefieldWeaponPrototype<EquipmentId.M4A1>;
