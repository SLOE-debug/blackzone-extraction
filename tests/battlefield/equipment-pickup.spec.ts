import { describe, expect, it } from 'vitest';
import {
  type BattlefieldEquipmentPickupSource,
  BattlefieldEquipmentPickupSystem,
} from '../../assets/bundles/battlefield/equipment/population/battlefield-equipment-pickup-system';
import { BattlefieldInteractionAction } from '../../assets/bundles/battlefield/interaction/model/battlefield-interaction';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';

describe('事务式物品栏拾取', () => {
  it('物品栏提交成功后才移除地面实例', () => {
    const calls: string[] = [];
    const source = createSource(() => {
      calls.push('remove');
      return true;
    });
    const pickup = new BattlefieldEquipmentPickupSystem(source, {
      tryInsert: (equipmentId, count, seed) => {
        calls.push('insert');
        expect(equipmentId).toBe(EquipmentId.Sledgehammer);
        expect(count).toBe(1);
        expect(seed).toBe(907);
        return true;
      },
    });

    expect(pickup.activateInteraction(
      73,
      BattlefieldInteractionAction.PickupEquipment,
    )).toBe(true);
    expect(calls).toEqual(['insert', 'remove']);
  });

  it('物品栏已满时保留地面实例', () => {
    let removeCount = 0;
    const pickup = new BattlefieldEquipmentPickupSystem(
      createSource(() => {
        removeCount++;
        return true;
      }),
      { tryInsert: () => false },
    );

    expect(pickup.activateInteraction(
      91,
      BattlefieldInteractionAction.PickupEquipment,
    )).toBe(false);
    expect(removeCount).toBe(0);
  });
});

function createSource(
  remove: (worldRuntimeId: number) => boolean,
): BattlefieldEquipmentPickupSource {
  return {
    writeNearestEquipmentInspection: () => false,
    getDroppedEquipment: () => Object.freeze({
      equipmentId: EquipmentId.Sledgehammer,
      itemInstanceSeed: 907,
    }),
    removeDroppedEquipment: remove,
  };
}
