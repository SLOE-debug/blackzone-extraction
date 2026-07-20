import {
  EquipmentCategory,
  type EquipmentDefinition,
  EquipmentId,
  type EquipmentLibrary,
  EquipmentRarity,
  WeaponAmmunitionMode,
  WeaponClass,
  WeaponProjectileVisual,
  WeaponShotPatternType,
} from '../../../../core/equipment/equipment';

/** 战场当前可生成装备的完整强类型清单。 */
const BATTLEFIELD_EQUIPMENT_DEFINITIONS = Object.freeze({
  [EquipmentId.DesertEagle]: Object.freeze({
    id: EquipmentId.DesertEagle,
    category: EquipmentCategory.Weapon,
    displayName: '沙漠之鹰',
    description: '高威力大口径半自动手枪',
    rarity: EquipmentRarity.Epic,
    weaponClass: WeaponClass.Handgun,
    damage: 74,
    fireIntervalSeconds: 0.32,
    attackAnimationSeconds: 0.22,
    ammunition: Object.freeze({
      mode: WeaponAmmunitionMode.Infinite,
    }),
    shotPattern: Object.freeze({
      type: WeaponShotPatternType.Single,
    }),
    projectile: Object.freeze({
      speed: 31,
      maximumRange: 20,
      impactRadius: 0.12,
      visual: WeaponProjectileVisual.Bullet,
    }),
  }),
  [EquipmentId.PumpShotgun]: Object.freeze({
    id: EquipmentId.PumpShotgun,
    category: EquipmentCategory.Weapon,
    displayName: '泵动霰弹枪',
    description: '近距离爆发强劲的管式弹仓霰弹枪',
    rarity: EquipmentRarity.Rare,
    weaponClass: WeaponClass.Shotgun,
    damage: 20,
    fireIntervalSeconds: 0.88,
    attackAnimationSeconds: 0.68,
    ammunition: Object.freeze({
      mode: WeaponAmmunitionMode.TubeMagazine,
      capacity: 5,
      shellReloadSeconds: 0.62,
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
      visual: WeaponProjectileVisual.BuckshotPellet,
    }),
  }),
} satisfies Readonly<Record<EquipmentId, EquipmentDefinition>>);

/** 通过 EquipmentId 查询战场装备定义的只读实现。 */
class BattlefieldEquipmentLibrary implements EquipmentLibrary {
  public get(id: EquipmentId): Readonly<EquipmentDefinition> {
    const definition = BATTLEFIELD_EQUIPMENT_DEFINITIONS[id];
    if (definition === undefined) {
      throw new Error(`战场装备尚未登记：${id}。`);
    }
    return definition;
  }
}

/** 宝箱、掉落物和 HUD 共享的战场装备库门面。 */
export const BATTLEFIELD_EQUIPMENT_LIBRARY: EquipmentLibrary = Object.freeze(
  new BattlefieldEquipmentLibrary(),
);
