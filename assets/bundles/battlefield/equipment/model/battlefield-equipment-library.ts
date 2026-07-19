import {
  EquipmentCategory,
  type EquipmentDefinition,
  EquipmentId,
  type EquipmentLibrary,
  EquipmentRarity,
  WeaponAmmunitionMode,
  WeaponClass,
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
    ammunition: Object.freeze({
      mode: WeaponAmmunitionMode.Infinite,
    }),
    projectile: Object.freeze({
      speed: 31,
      maximumRange: 20,
      impactRadius: 0.12,
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
