import {
  AmmunitionType,
  EquipmentCategory,
  type EquipmentDefinitionById,
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
    description: '稳定轻便的蓝色制式半自动手枪',
    rarity: EquipmentRarity.Rare,
    weaponClass: WeaponClass.Handgun,
    damage: 32,
    fireIntervalSeconds: 0.32,
    attackAnimationSeconds: 0.22,
    ammunition: Object.freeze({
      mode: WeaponAmmunitionMode.Magazine,
      ammunitionType: AmmunitionType.HandgunRound,
      capacity: 8,
      reloadSeconds: 1.08,
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
      ammunitionType: AmmunitionType.ShotgunShell,
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
  [EquipmentId.HandgunAmmunition]: Object.freeze({
    id: EquipmentId.HandgunAmmunition,
    category: EquipmentCategory.Ammunition,
    displayName: '手枪弹药',
    description: '十八发制式手枪备用弹',
    rarity: EquipmentRarity.Common,
    ammunitionType: AmmunitionType.HandgunRound,
    rounds: 18,
  }),
  [EquipmentId.ShotgunAmmunition]: Object.freeze({
    id: EquipmentId.ShotgunAmmunition,
    category: EquipmentCategory.Ammunition,
    displayName: '霰弹枪弹药',
    description: '八发十二号霰弹枪备用弹',
    rarity: EquipmentRarity.Common,
    ammunitionType: AmmunitionType.ShotgunShell,
    rounds: 8,
  }),
} satisfies Readonly<EquipmentDefinitionById>);

/** 通过 EquipmentId 查询战场装备定义的只读实现。 */
class BattlefieldEquipmentLibrary implements EquipmentLibrary {
  public get<TId extends EquipmentId>(
    id: TId,
  ): Readonly<EquipmentDefinitionById[TId]> {
    const definition = BATTLEFIELD_EQUIPMENT_DEFINITIONS[id];
    if (definition === undefined) {
      throw new Error(`战场装备尚未登记：${id}。`);
    }
    return definition as Readonly<EquipmentDefinitionById[TId]>;
  }
}

/** 宝箱、掉落物和 HUD 共享的战场装备库门面。 */
export const BATTLEFIELD_EQUIPMENT_LIBRARY: EquipmentLibrary = Object.freeze(
  new BattlefieldEquipmentLibrary(),
);
