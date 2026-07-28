import { WeightedLootTable } from '../../../../core/loot/weighted-loot-table';
import { EquipmentId } from '../../equipment/catalog/equipment-id';

/** 单个宝箱当前固定释放的最大物品数，供加载期渲染容量计算。 */
export const BATTLEFIELD_TREASURE_MAXIMUM_LOOT_COUNT = 1;

/** 战场宝箱在两种已登记武器之间执行确定性等权抽取。 */
export const BATTLEFIELD_TREASURE_LOOT_TABLE = Object.freeze(
  new WeightedLootTable<EquipmentId>({
    minimumDrops: 1,
    maximumDrops: 1,
    entries: Object.freeze([
      Object.freeze({ id: EquipmentId.Sledgehammer, weight: 1 }),
      Object.freeze({ id: EquipmentId.ReturningBow, weight: 1 }),
    ]),
  }),
);
