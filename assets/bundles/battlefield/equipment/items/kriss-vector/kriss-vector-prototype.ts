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
import { KRISS_VECTOR_GEOMETRY } from './kriss-vector-geometry';

/** KRISS Vector 在战场中的完整玩法与精细程序化原型。 */
export const KRISS_VECTOR_PROTOTYPE = Object.freeze({
  id: EquipmentId.KrissVector,
  definition: Object.freeze({
    id: EquipmentId.KrissVector,
    category: EquipmentCategory.Weapon,
    displayName: 'KRISS Vector',
    description: '高射速、低枪管轴的传奇 .45 ACP 冲锋枪',
    rarity: EquipmentRarity.Legendary,
    weaponClass: WeaponClass.SubmachineGun,
    damage: 17,
    fireIntervalSeconds: 0.072,
    attackAnimationSeconds: 0.105,
    ammunition: Object.freeze({
      mode: WeaponAmmunitionMode.Magazine,
      ammunitionType: AmmunitionType.FortyFiveAcp,
      capacity: 33,
      reloadSeconds: 1.22,
      initialReserveRounds: 210,
    }),
    shotPattern: Object.freeze({ type: WeaponShotPatternType.Single }),
    projectile: Object.freeze({
      speed: 29,
      maximumRange: 18,
      impactRadius: 0.105,
      maximumHitCount: 2,
      damageRetention: 0.62,
      visual: WeaponProjectileVisual.Bullet,
    }),
  }),
  geometry: KRISS_VECTOR_GEOMETRY,
  dropped: Object.freeze({ scale: 0.31 }),
  held: Object.freeze({
    grip: WeaponGrip.LongGun,
    heldScale: 0.34,
    originRightOffset: 0,
    originHeightOffset: 0.045,
    originForwardOffset: 0.08,
    muzzleRightOffset: 0,
    muzzleHeightOffset: 0.213,
    muzzleForwardOffset: 0.794,
    rotationXDegrees: 0,
    rotationYDegrees: -90,
    rotationZDegrees: 0,
  }),
}) satisfies BattlefieldWeaponPrototype<EquipmentId.KrissVector>;
