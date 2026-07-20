import {
  advanceRandomState,
  nextRandom,
  normalizeRandomSeed,
  randomInteger,
  randomRange,
} from '../../../../core/math/xorshift32';
import { createChunkCoordinate, type ChunkCoordinate } from '../../../../core/world/chunk-coordinate';
import { BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG } from '../../environment/model/battlefield-environment-config';

/** 一个由固定 Chunk 持有的程序化宝箱生成描述。 */
export interface BattlefieldTreasureChestSpawn {
  readonly chunk: Readonly<ChunkCoordinate>;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly heading: number;
  readonly seed: number;
}

/** 宝箱在无限地图中的稀疏密度、边界留白和起始区保底规则。 */
export const BATTLEFIELD_TREASURE_CHEST_GENERATION = Object.freeze({
  seed: 0x9e45c158,
  generationChance: 0.02,
  minimumChestsPerGeneratedChunk: 1,
  maximumChestsPerGeneratedChunk: 1,
  minimumOriginChests: 1,
  maximumOriginChests: 1,
  chunkEdgePadding: 5.5,
  minimumChestSpacing: 6,
  originSafePadding: 2.5,
  elevation: 0.04,
});

/** 无宝箱 Chunk 复用的不可变空结果。 */
const EMPTY_TREASURE_CHEST_SPAWNS = Object.freeze([]) as readonly BattlefieldTreasureChestSpawn[];

/**
 * 由 Chunk 坐标确定性生成零至一个稀有宝箱，起始 Chunk 只保留一个教学保底。
 *
 * 同一 Chunk 卸载后重新进入会恢复相同布局；位置和朝向仍呈随机分布，不会随帧抖动。
 */
export function createBattlefieldTreasureChestSpawns(
  chunk: Readonly<ChunkCoordinate>,
): readonly BattlefieldTreasureChestSpawn[] {
  const stableChunk = createChunkCoordinate(chunk.x, chunk.z);
  const randomState = Uint32Array.of(hashChunkCoordinates(
    stableChunk.x,
    stableChunk.z,
    BATTLEFIELD_TREASURE_CHEST_GENERATION.seed,
  ));
  const isOriginChunk = stableChunk.x === 0 && stableChunk.z === 0;
  if (!isOriginChunk
    && nextRandom(randomState, 0) >= BATTLEFIELD_TREASURE_CHEST_GENERATION.generationChance) {
    return EMPTY_TREASURE_CHEST_SPAWNS;
  }

  const minimumCount = isOriginChunk
    ? BATTLEFIELD_TREASURE_CHEST_GENERATION.minimumOriginChests
    : BATTLEFIELD_TREASURE_CHEST_GENERATION.minimumChestsPerGeneratedChunk;
  const maximumCount = isOriginChunk
    ? BATTLEFIELD_TREASURE_CHEST_GENERATION.maximumOriginChests
    : BATTLEFIELD_TREASURE_CHEST_GENERATION.maximumChestsPerGeneratedChunk;
  const count = randomInteger(randomState, 0, minimumCount, maximumCount + 1);
  const spawns: BattlefieldTreasureChestSpawn[] = [];
  for (let index = 0; index < count; index++) {
    const position = createChestPosition(randomState, stableChunk, isOriginChunk, spawns);
    const spawnSeed = advanceRandomState(randomState[0] ?? 1);
    randomState[0] = spawnSeed;
    spawns.push(Object.freeze({
      chunk: stableChunk,
      x: position.x,
      y: BATTLEFIELD_TREASURE_CHEST_GENERATION.elevation,
      z: position.z,
      heading: randomRange(randomState, 0, -Math.PI, Math.PI),
      seed: spawnSeed,
    }));
  }
  return Object.freeze(spawns);
}

/** 在 Chunk 边缘内寻找与同区宝箱保持间距的位置。 */
function createChestPosition(
  randomState: Uint32Array,
  chunk: Readonly<ChunkCoordinate>,
  isOriginChunk: boolean,
  existing: readonly BattlefieldTreasureChestSpawn[],
): Readonly<{ x: number; z: number }> {
  const config = BATTLEFIELD_TREASURE_CHEST_GENERATION;
  const size = BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.chunkSize;
  const centerX = chunk.x * size;
  const centerZ = chunk.z * size;
  const extent = size * 0.5 - config.chunkEdgePadding;
  let x = centerX;
  let z = centerZ;
  for (let attempt = 0; attempt < 8; attempt++) {
    if (isOriginChunk) {
      const angle = randomRange(randomState, 0, -Math.PI, Math.PI);
      const minimumRadius = BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.playerSafeRadius
        + config.originSafePadding;
      const radius = Math.sqrt(randomRange(
        randomState,
        0,
        minimumRadius * minimumRadius,
        extent * extent,
      ));
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
    } else {
      x = centerX + randomRange(randomState, 0, -extent, extent);
      z = centerZ + randomRange(randomState, 0, -extent, extent);
    }
    if (isSeparatedFromExisting(x, z, existing, config.minimumChestSpacing)) {
      break;
    }
  }
  return Object.freeze({ x, z });
}

function isSeparatedFromExisting(
  x: number,
  z: number,
  existing: readonly BattlefieldTreasureChestSpawn[],
  minimumSpacing: number,
): boolean {
  const minimumDistanceSquared = minimumSpacing * minimumSpacing;
  for (const spawn of existing) {
    const deltaX = spawn.x - x;
    const deltaZ = spawn.z - z;
    if (deltaX * deltaX + deltaZ * deltaZ < minimumDistanceSquared) {
      return false;
    }
  }
  return true;
}

/** 将有符号 Chunk 坐标混合成非零的独立随机序列。 */
function hashChunkCoordinates(chunkX: number, chunkZ: number, seed: number): number {
  let value = normalizeRandomSeed(seed)
    ^ Math.imul(chunkX | 0, 0x45d9f3b)
    ^ Math.imul(chunkZ | 0, 0x119de1f3);
  value ^= value >>> 16;
  value = Math.imul(value, 0x45d9f3b);
  value ^= value >>> 16;
  return normalizeRandomSeed(value);
}
