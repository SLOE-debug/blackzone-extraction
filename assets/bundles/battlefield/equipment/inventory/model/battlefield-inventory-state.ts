import { EquipmentId } from '../../catalog/equipment-id';

/** 普通物品栏固定容量；撤离锁定格不占用这五格。 */
export const BATTLEFIELD_INVENTORY_CAPACITY = 5;

/** 单个物品格的稳定只读快照。 */
export interface BattlefieldInventorySlot {
  readonly itemId: EquipmentId | null;
  readonly stackCount: number;
  readonly instanceSeed: number;
  readonly occupied: boolean;
}

/** HUD 与撤离结算共享的物品栏快照。 */
export interface BattlefieldInventorySnapshot {
  readonly slots: readonly Readonly<BattlefieldInventorySlot>[];
  readonly secured: Readonly<BattlefieldInventorySlot>;
  readonly revision: number;
}

/** 创建不会被调用方修改的空格快照。 */
export function createEmptyBattlefieldInventorySlot(): Readonly<BattlefieldInventorySlot> {
  return Object.freeze({
    itemId: null,
    stackCount: 0,
    instanceSeed: 0,
    occupied: false,
  });
}
