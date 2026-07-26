import { type BattlefieldInventorySlot, type BattlefieldInventorySnapshot } from '../model/battlefield-inventory-state';

/** 离场结算的两种稳定结果。 */
export enum BattlefieldExtractionOutcome {
  Success = 'success',
  Failure = 'failure',
}

/** 撤离结算返回的最终携带物。 */
export interface BattlefieldExtractionSettlement {
  readonly carried: readonly Readonly<BattlefieldInventorySlot>[];
}

/** 成功时带出普通五格与锁定格，失败时只保留撤离锁定格。 */
export class BattlefieldExtractionSettlementSystem {
  public settle(
    inventory: Readonly<BattlefieldInventorySnapshot>,
    outcome: BattlefieldExtractionOutcome,
  ): Readonly<BattlefieldExtractionSettlement> {
    const carried: Readonly<BattlefieldInventorySlot>[] = [];
    if (outcome === BattlefieldExtractionOutcome.Success) {
      for (const slot of inventory.slots) {
        if (slot.occupied) {
          carried.push(slot);
        }
      }
    }
    if (inventory.secured.occupied) {
      carried.push(inventory.secured);
    }
    return Object.freeze({ carried: Object.freeze(carried) });
  }
}
