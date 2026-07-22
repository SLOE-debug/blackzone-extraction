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
import { PUMP_SHOTGUN_GEOMETRY } from './pump-shotgun-geometry';
import {
  type BattlefieldWeaponPrototype,
} from '../../catalog/battlefield-equipment-prototype';
import { EquipmentId } from '../../catalog/equipment-id';

/** 泵动霰弹枪在战场中的完整玩法与可视原型。 */
export const PUMP_SHOTGUN_PROTOTYPE = Object.freeze({
  id: EquipmentId.PumpShotgun,
  definition: Object.freeze({
    id: EquipmentId.PumpShotgun,
    category: EquipmentCategory.Weapon,
    displayName: '泵动霰弹枪',
    description: '近距离爆发强劲的管式弹仓霰弹枪',
    rarity: EquipmentRarity.Rare,
    weaponClass: WeaponClass.Shotgun,
    damage: 22,
    fireIntervalSeconds: 0.88,
    attackAnimationSeconds: 0.68,
    ammunition: Object.freeze({
      mode: WeaponAmmunitionMode.TubeMagazine,
      ammunitionType: AmmunitionType.TwelveGauge,
      capacity: 5,
      shellReloadSeconds: 0.62,
      initialReserveRounds: 36,
    }),
    shotPattern: Object.freeze({
      type: WeaponShotPatternType.PelletCone,
      projectileCount: 9,
      horizontalSpreadRadians: 0.115,
      verticalSpreadRadians: 0.075,
    }),
    projectile: Object.freeze({
      speed: 26,
      maximumRange: 14,
      impactRadius: 0.09,
      maximumHitCount: 2,
      damageRetention: 0.58,
      visual: WeaponProjectileVisual.BuckshotPellet,
    }),
  }),
  geometry: PUMP_SHOTGUN_GEOMETRY,
  dropped: Object.freeze({ scale: 0.28 }),
  held: Object.freeze({
    grip: WeaponGrip.LongGun,
    heldScale: 0.34,
    originRightOffset: 0,
    originHeightOffset: 0.055,
    originForwardOffset: 0.045,
    muzzleRightOffset: 0,
    muzzleHeightOffset: 0.118,
    muzzleForwardOffset: 0.998,
    rotationXDegrees: 0,
    rotationYDegrees: -90,
    rotationZDegrees: 0,
  }),
}) satisfies BattlefieldWeaponPrototype<EquipmentId.PumpShotgun>;
