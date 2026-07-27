import { type BattlefieldPlayerDiscardRequest } from '../../population/dropped-equipment-population';
import { type BattlefieldInventoryRuntime } from './battlefield-inventory-runtime';

/** 世界掉落池向物品栏丢弃事务提供的最小门面。 */
export interface BattlefieldInventoryDiscardTarget {
  canSpawnPlayerDiscard(): boolean;
  trySpawnPlayerDiscard(request: Readonly<BattlefieldPlayerDiscardRequest>): boolean;
}

/** 玩家丢弃动作的世界位置与方向。 */
export interface BattlefieldInventoryDiscardPose {
  readonly originX: number;
  readonly originY: number;
  readonly originZ: number;
  readonly directionX: number;
  readonly directionZ: number;
}

/**
 * 先检查固定池容量，再临时提取背包物品并提交世界生成。
 *
 * 世界生成拒绝请求时会把物品和原装备选择恢复到同一格，保证不复制也不吞物。
 */
export function tryDiscardBattlefieldInventorySlot(
  inventory: BattlefieldInventoryRuntime,
  target: BattlefieldInventoryDiscardTarget,
  slotIndex: number,
  pose: Readonly<BattlefieldInventoryDiscardPose>,
): boolean {
  if (!target.canSpawnPlayerDiscard()) {
    return false;
  }
  const transfer = inventory.extractSlot(slotIndex);
  if (transfer === null) {
    return false;
  }
  const committed = target.trySpawnPlayerDiscard({
    equipmentId: transfer.itemId,
    itemInstanceSeed: transfer.instanceSeed,
    stackCount: transfer.stackCount,
    originX: pose.originX,
    originY: pose.originY,
    originZ: pose.originZ,
    directionX: pose.directionX,
    directionZ: pose.directionZ,
  });
  if (!committed) {
    inventory.restoreTransfer(transfer);
  }
  return committed;
}
