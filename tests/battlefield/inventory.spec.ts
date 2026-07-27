import { describe, expect, it } from 'vitest';
import { BATTLEFIELD_EQUIPMENT_LIBRARY } from '../../assets/bundles/battlefield/equipment/catalog/battlefield-equipment-catalog';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';
import { BattlefieldInventoryRuntime } from '../../assets/bundles/battlefield/equipment/inventory/population/battlefield-inventory-runtime';
import { tryDiscardBattlefieldInventorySlot } from '../../assets/bundles/battlefield/equipment/inventory/population/battlefield-inventory-discard-transaction';
import {
  BattlefieldExtractionOutcome,
  BattlefieldExtractionSettlementSystem,
} from '../../assets/bundles/battlefield/equipment/inventory/population/battlefield-extraction-settlement-system';

describe('固定五格物品栏与撤离锁定格', () => {
  it('开局五格、锁定格和装备选择全部为空', () => {
    const snapshot = new BattlefieldInventoryRuntime(
      BATTLEFIELD_EQUIPMENT_LIBRARY,
    ).createSnapshot();
    expect(snapshot.slots.every((slot) => !slot.occupied)).toBe(true);
    expect(snapshot.secured.occupied).toBe(false);
    expect(snapshot.selectedInstanceSeed).toBeNull();
  });

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

  it('装备选择绑定实例种子并在普通格交换后保持选择', () => {
    const inventory = new BattlefieldInventoryRuntime(BATTLEFIELD_EQUIPMENT_LIBRARY);
    inventory.tryInsert(EquipmentId.Sledgehammer, 1, 71);
    inventory.tryInsert(EquipmentId.Sledgehammer, 1, 72);
    expect(inventory.selectItem(71)).toBe(true);
    expect(inventory.swapSlots(0, 3)).toBe(true);
    expect(inventory.selectedInstanceSeed).toBe(71);
    expect(inventory.getSlot(3).instanceSeed).toBe(71);
    expect(inventory.getSelectedItem()).toEqual({
      equipmentId: EquipmentId.Sledgehammer,
      itemInstanceSeed: 71,
    });
  });

  it('丢弃池拒绝提交时恢复原格和手持选择', () => {
    const inventory = new BattlefieldInventoryRuntime(BATTLEFIELD_EQUIPMENT_LIBRARY);
    inventory.tryInsert(EquipmentId.Sledgehammer, 1, 88);
    inventory.selectItem(88);
    expect(tryDiscardBattlefieldInventorySlot(
      inventory,
      {
        canSpawnPlayerDiscard: () => true,
        trySpawnPlayerDiscard: () => false,
      },
      0,
      { originX: 0, originY: 0, originZ: 0, directionX: 0, directionZ: 1 },
    )).toBe(false);
    expect(inventory.getSlot(0).instanceSeed).toBe(88);
    expect(inventory.selectedInstanceSeed).toBe(88);
  });

  it('丢弃成功后移除原格并把永久实例种子提交给世界', () => {
    const inventory = new BattlefieldInventoryRuntime(BATTLEFIELD_EQUIPMENT_LIBRARY);
    inventory.tryInsert(EquipmentId.Sledgehammer, 1, 99);
    inventory.selectItem(99);
    let discardedSeed = 0;
    expect(tryDiscardBattlefieldInventorySlot(
      inventory,
      {
        canSpawnPlayerDiscard: () => true,
        trySpawnPlayerDiscard: (request) => {
          discardedSeed = request.itemInstanceSeed;
          return true;
        },
      },
      0,
      { originX: 1, originY: 0, originZ: 2, directionX: 1, directionZ: 0 },
    )).toBe(true);
    expect(discardedSeed).toBe(99);
    expect(inventory.getSlot(0).occupied).toBe(false);
    expect(inventory.selectedInstanceSeed).toBeNull();
  });
});
