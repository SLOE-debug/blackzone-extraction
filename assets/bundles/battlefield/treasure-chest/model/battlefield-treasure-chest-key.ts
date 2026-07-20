import {
  toChunkCoordinateKey,
  type ChunkCoordinate,
} from '../../../../core/world/chunk-coordinate';

declare const battlefieldTreasureChestKeyBrand: unique symbol;

/** 由 Chunk 坐标和区内生成序号共同确定的宝箱稳定标识。 */
export type BattlefieldTreasureChestKey = string & {
  readonly [battlefieldTreasureChestKeyBrand]: true;
};

/** 为确定性生成的宝箱创建跨 Chunk 卸载仍保持一致的类型化 key。 */
export function createBattlefieldTreasureChestKey(
  chunk: Readonly<ChunkCoordinate>,
  spawnIndex: number,
): BattlefieldTreasureChestKey {
  if (!Number.isSafeInteger(spawnIndex) || spawnIndex < 0) {
    throw new Error('宝箱区内生成序号必须是非负安全整数。');
  }
  return `${toChunkCoordinateKey(chunk)}:${spawnIndex}` as BattlefieldTreasureChestKey;
}
