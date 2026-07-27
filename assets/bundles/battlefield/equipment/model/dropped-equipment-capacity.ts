/** 根据活动 Chunk 窗口和单箱掉落上限计算固定掉落池容量。 */
export function calculateDroppedEquipmentCapacity(
  activeChunkRadius: number,
  maximumChestsPerChunk: number,
  maximumLootPerChest: number,
  maximumPlayerDiscardedEquipment: number,
): number {
  if ([
    activeChunkRadius,
    maximumChestsPerChunk,
    maximumLootPerChest,
    maximumPlayerDiscardedEquipment,
  ].some((value) => !Number.isInteger(value))
    || activeChunkRadius < 0
    || maximumChestsPerChunk <= 0
    || maximumLootPerChest <= 0
    || maximumPlayerDiscardedEquipment < 0) {
    throw new Error('掉落装备容量参数必须是有效整数。');
  }
  const activeChunkDiameter = activeChunkRadius * 2 + 1;
  return activeChunkDiameter
    * activeChunkDiameter
    * maximumChestsPerChunk
    * maximumLootPerChest
    + maximumPlayerDiscardedEquipment;
}

/** 为玩家反复拾取和丢弃预留的固定世界槽位。 */
export const BATTLEFIELD_MAXIMUM_PLAYER_DISCARDED_EQUIPMENT = 24;
