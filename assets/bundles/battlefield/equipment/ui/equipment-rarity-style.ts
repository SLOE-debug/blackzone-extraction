import { Color } from 'cc';
import { EquipmentRarity } from '../../../../core/equipment/equipment';
import { EQUIPMENT_RARITY_PALETTE } from '../model/equipment-rarity-palette';

/** 装备品质在世界标签中的边框与文字颜色。 */
export const EQUIPMENT_RARITY_STYLE = Object.freeze({
  [EquipmentRarity.Common]: Object.freeze({
    color: toColor(EquipmentRarity.Common),
  }),
  [EquipmentRarity.Rare]: Object.freeze({
    color: toColor(EquipmentRarity.Rare),
  }),
  [EquipmentRarity.Epic]: Object.freeze({
    color: toColor(EquipmentRarity.Epic),
  }),
  [EquipmentRarity.Legendary]: Object.freeze({
    color: toColor(EquipmentRarity.Legendary),
  }),
} satisfies Readonly<Record<EquipmentRarity, {
  readonly color: Readonly<Color>;
}>>);

function toColor(rarity: EquipmentRarity): Color {
  const color = EQUIPMENT_RARITY_PALETTE[rarity];
  return new Color(color.red, color.green, color.blue, 255);
}
