import { type LootTable } from '../../../../core/loot/weighted-loot-table';
import { EquipmentId } from '../../equipment/catalog/equipment-id';

/** 单个宝箱当前固定释放的最大物品数，供加载期渲染容量计算。 */
export const BATTLEFIELD_TREASURE_MAXIMUM_LOOT_COUNT = 1;

/** 纯近战战场的宝箱只生成已登记的大锤原型。 */
class BattlefieldTreasureLootTable implements LootTable<EquipmentId> {
  public roll(): readonly EquipmentId[] {
    return Object.freeze([EquipmentId.Sledgehammer]);
  }
}

/** 战场宝箱共享的不可变掉落表门面。 */
export const BATTLEFIELD_TREASURE_LOOT_TABLE: LootTable<EquipmentId> = Object.freeze(
  new BattlefieldTreasureLootTable(),
);
