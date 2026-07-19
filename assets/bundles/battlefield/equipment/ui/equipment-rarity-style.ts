import { Color } from 'cc';
import { EquipmentRarity } from '../../../../core/equipment/equipment';

/** 装备品质在世界标签中的中文名称与颜色。 */
export const EQUIPMENT_RARITY_STYLE = Object.freeze({
  [EquipmentRarity.Common]: Object.freeze({
    displayName: '普通',
    color: new Color(205, 214, 211, 255),
  }),
  [EquipmentRarity.Rare]: Object.freeze({
    displayName: '稀有',
    color: new Color(74, 157, 255, 255),
  }),
  [EquipmentRarity.Epic]: Object.freeze({
    displayName: '史诗',
    color: new Color(190, 94, 255, 255),
  }),
  [EquipmentRarity.Legendary]: Object.freeze({
    displayName: '传说',
    color: new Color(255, 146, 46, 255),
  }),
} satisfies Readonly<Record<EquipmentRarity, {
  readonly displayName: string;
  readonly color: Readonly<Color>;
}>>);
