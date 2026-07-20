import { EquipmentId } from '../../../../core/equipment/equipment';
import {
  type LootTable,
  WeightedLootTable,
} from '../../../../core/loot/weighted-loot-table';

/** 起始宝箱使用的装备掉落表；数量和候选权重均可独立扩展。 */
export const BATTLEFIELD_TREASURE_LOOT_TABLE: LootTable<EquipmentId> =
  new WeightedLootTable<EquipmentId>({
    minimumDrops: 1,
    maximumDrops: 3,
    entries: Object.freeze([
      Object.freeze({
        id: EquipmentId.DesertEagle,
        weight: 1,
      }),
    ]),
  });
