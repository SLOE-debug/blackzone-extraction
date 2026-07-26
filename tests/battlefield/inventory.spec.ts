import { describe, expect, it } from 'vitest';
import { BATTLEFIELD_EQUIPMENT_LIBRARY } from '../../assets/bundles/battlefield/equipment/catalog/battlefield-equipment-catalog';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';
import { BattlefieldInventoryRuntime } from '../../assets/bundles/battlefield/equipment/inventory/population/battlefield-inventory-runtime';
import {
  BattlefieldExtractionOutcome,
  BattlefieldExtractionSettlementSystem,
} from '../../assets/bundles/battlefield/equipment/inventory/population/battlefield-extraction-settlement-system';

describe('固定五格物品栏与撤离锁定格', () => {
  it('满包插入失败时快照保持不变', () => {
    const inventory = new BattlefieldInventoryRuntime(BATTLEFIELD_EQUIPMENT_LIBRARY);
    for (let index = 1; index <= 5; index++) {
      expect(inventory.tryInsert(EquipmentId.Sledgehammer, 1, index)).toBe(true);
    }
    const before = inventory.createSnapshot();
    expect(inventory.tryInsert(EquipmentId.Sledgehammer, 1, 6)).toBe(false);
    expect(inventory.createSnapshot()).toEqual(before);
  });

  it('普通格可与独立锁定格交换且不占用五格容量', () => {
    const inventory = new BattlefieldInventoryRuntime(BATTLEFIELD_EQUIPMENT_LIBRARY);
    inventory.tryInsert(EquipmentId.Sledgehammer, 1, 41);
    expect(inventory.swapWithSecured(0)).toBe(true);
    const snapshot = inventory.createSnapshot();
    expect(snapshot.slots).toHaveLength(5);
    expect(snapshot.slots[0]?.occupied).toBe(false);
    expect(snapshot.secured.instanceSeed).toBe(41);
  });

  it('失败离场只结算锁定格，成功撤离同时结算普通格', () => {
    const inventory = new BattlefieldInventoryRuntime(BATTLEFIELD_EQUIPMENT_LIBRARY);
    inventory.tryInsert(EquipmentId.Sledgehammer, 1, 11);
    inventory.tryInsert(EquipmentId.Sledgehammer, 1, 12);
    inventory.swapWithSecured(0);
    const snapshot = inventory.createSnapshot();
    const settlement = new BattlefieldExtractionSettlementSystem();
    expect(settlement.settle(snapshot, BattlefieldExtractionOutcome.Failure).carried)
      .toHaveLength(1);
    expect(settlement.settle(snapshot, BattlefieldExtractionOutcome.Success).carried)
      .toHaveLength(2);
  });
});
