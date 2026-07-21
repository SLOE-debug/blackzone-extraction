import { EquipmentRarity } from '../../../../core/equipment/equipment';

/** 品质色在 UI、掉落物本体和 Unlit 渐隐光管间共享的字节 RGB。 */
export interface EquipmentRarityColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

/** 全部装备品质的唯一颜色清单。 */
export const EQUIPMENT_RARITY_PALETTE = Object.freeze({
  [EquipmentRarity.Common]: color(205, 214, 211),
  [EquipmentRarity.Rare]: color(74, 157, 255),
  [EquipmentRarity.Epic]: color(190, 94, 255),
  [EquipmentRarity.Legendary]: color(255, 146, 46),
} satisfies Readonly<Record<EquipmentRarity, Readonly<EquipmentRarityColor>>>);

function color(red: number, green: number, blue: number): Readonly<EquipmentRarityColor> {
  return Object.freeze({ red, green, blue });
}
