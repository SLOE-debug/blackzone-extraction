import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { tryDiscardBattlefieldInventorySlot } from '../../equipment/inventory/population/battlefield-inventory-discard-transaction';
import { BattlefieldInventoryHudCommandKind } from '../../equipment/inventory/ui/battlefield-inventory-hud-command';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在武器输入前提交点击装备、换格、锁定格与世界丢弃事务。 */
export class BattlefieldInventoryWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Input;
  public readonly order = 5;
  protected readonly performanceStage = BattlefieldPerformanceStage.Control;

  protected execute(world: BattlefieldWorld): void {
    const { controls, inventory, treasures, player } = world.resources;
    const command = controls.consumeInventoryCommand();
    if (command === null) {
      return;
    }
    switch (command.kind) {
      case BattlefieldInventoryHudCommandKind.SelectSlot: {
        const slot = inventory.getSlot(command.slotIndex);
        if (slot.occupied) {
          inventory.selectItem(
            inventory.selectedInstanceSeed === slot.instanceSeed ? null : slot.instanceSeed,
          );
        }
        break;
      }
      case BattlefieldInventoryHudCommandKind.SwapSlots:
        inventory.swapSlots(command.firstSlotIndex, command.secondSlotIndex);
        break;
      case BattlefieldInventoryHudCommandKind.SwapWithSecured:
        inventory.swapWithSecured(command.slotIndex);
        break;
      case BattlefieldInventoryHudCommandKind.DiscardSlot:
        tryDiscardBattlefieldInventorySlot(
          inventory,
          treasures,
          command.slotIndex,
          {
            originX: player.positionX,
            originY: player.positionY,
            originZ: player.positionZ,
            directionX: Math.sin(player.heading),
            directionZ: Math.cos(player.heading),
          },
        );
        break;
    }
    synchronizeEquippedItem(world);
    controls.synchronizeInventory();
  }
}

function synchronizeEquippedItem(world: BattlefieldWorld): void {
  const { inventory, weapon } = world.resources;
  const selected = inventory.getSelectedItem();
  if (selected === null) {
    if (weapon.equipped) {
      weapon.unequip();
    }
    return;
  }
  weapon.equip(selected);
}
