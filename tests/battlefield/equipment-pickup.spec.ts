import { describe, expect, it } from 'vitest';
import {
  type BattlefieldEquipmentPickupSource,
  BattlefieldEquipmentPickupSystem,
  type BattlefieldEquipmentWeaponSlot,
} from '../../assets/bundles/battlefield/equipment/population/battlefield-equipment-pickup-system';
import { BattlefieldInteractionAction } from '../../assets/bundles/battlefield/interaction/model/battlefield-interaction';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';

describe('玩家唯一武器槽拾取替换', () => {
  it('成功拾取新武器后移除世界实例，并把旧武器从玩家位置轻抛出去', () => {
    let removedInstanceId = -1;
    let discardedEquipmentId: EquipmentId | null = null;
    let discardedY = 0;
    const source: BattlefieldEquipmentPickupSource = {
      writeNearestEquipmentInspection: () => false,
      getDroppedEquipmentId: () => EquipmentId.DesertEagle,
      removeDroppedEquipment: (instanceId) => {
        removedInstanceId = instanceId;
        return true;
      },
      spawnPlayerDiscard: (equipmentId, _x, y) => {
        discardedEquipmentId = equipmentId;
        discardedY = y;
      },
    };
    const weaponSlot: BattlefieldEquipmentWeaponSlot = {
      receive: () => EquipmentId.DesertEagle,
    };
    const carrier = { positionX: 4, positionY: 0.05, positionZ: 2, heading: 0.4 };
    const pickup = new BattlefieldEquipmentPickupSystem(source, weaponSlot, carrier);

    expect(pickup.activateInteraction(
      73,
      BattlefieldInteractionAction.PickupEquipment,
    )).toBe(true);
    expect(removedInstanceId).toBe(73);
    expect(discardedEquipmentId).toBe(EquipmentId.DesertEagle);
    expect(discardedY).toBeCloseTo(carrier.positionY + 1.35);
  });

  it('拾取弹药后只移除世界实例，不会抛出当前武器', () => {
    let receivedEquipmentId: EquipmentId | null = null;
    let removed = false;
    let discardCount = 0;
    const source: BattlefieldEquipmentPickupSource = {
      writeNearestEquipmentInspection: () => false,
      getDroppedEquipmentId: () => EquipmentId.FiftyActionExpressAmmunition,
      removeDroppedEquipment: () => {
        removed = true;
        return true;
      },
      spawnPlayerDiscard: () => {
        discardCount++;
      },
    };
    const weaponSlot: BattlefieldEquipmentWeaponSlot = {
      receive: (equipmentId) => {
        receivedEquipmentId = equipmentId;
        return null;
      },
    };
    const pickup = new BattlefieldEquipmentPickupSystem(
      source,
      weaponSlot,
      { positionX: 0, positionY: 0, positionZ: 0, heading: 0 },
    );

    expect(pickup.activateInteraction(
      91,
      BattlefieldInteractionAction.PickupEquipment,
    )).toBe(true);
    expect(receivedEquipmentId).toBe(EquipmentId.FiftyActionExpressAmmunition);
    expect(removed).toBe(true);
    expect(discardCount).toBe(0);
  });
});
