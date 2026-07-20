import { EquipmentId } from '../../../../core/equipment/equipment';
import {
  type LootTable,
  WeightedLootTable,
} from '../../../../core/loot/weighted-loot-table';

/** 战场宝箱使用的类型化武器掉落表；每次独立随机产出一至三件。 */
export const BATTLEFIELD_TREASURE_LOOT_TABLE: LootTable<EquipmentId> =
  new WeightedLootTable<EquipmentId>({
    minimumDrops: 1,
    maximumDrops: 3,
    entries: Object.freeze([
      Object.freeze({
        id: EquipmentId.DesertEagle,
        weight: 1,
      }),
      Object.freeze({
        id: EquipmentId.PumpShotgun,
        weight: 0.72,
      }),
    ]),
  });
