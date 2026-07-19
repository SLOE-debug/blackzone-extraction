import { type ChunkCoordinate } from '../../../core/world/chunk-coordinate';
import { BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG } from '../environment/model/battlefield-environment-config';

/** 地图 Chunk 中一组随机蜘蛛的确定性生成结果。 */
export interface BattlefieldMonsterSpawn {
  readonly x: number;
  readonly z: number;
  readonly count: number;
  readonly seed: number;
}

/** 地图随机蜘蛛群使用的确定性生成参数。 */
export const BATTLEFIELD_MONSTER_SPAWN = Object.freeze({
  minimumCount: 4,
  maximumCountExclusive: 8,
  groupChance: 0.2,
  worldDiameter: 8.4,
  modelScale: 0.14,
  seed: 0x4b1ac7,
  groundOffsetY: 0.05,
});

/**
 * 为指定 Chunk 生成至多一组无可见固定设施的随机蜘蛛。
 *
 * 起始 Chunk 始终保留一组教学遭遇，其余 Chunk 由坐标哈希决定是否出现，
 * 同一地图坐标在重复加载后保持完全一致。
 */
export function createBattlefieldMonsterSpawn(
  chunk: Readonly<ChunkCoordinate>,
): Readonly<BattlefieldMonsterSpawn> | null {
  const config = BATTLEFIELD_MONSTER_SPAWN;
  const seed = hashSpawnCoordinate(chunk.x, chunk.z, config.seed);
  const isOriginChunk = chunk.x === 0 && chunk.z === 0;
  if (!isOriginChunk && hashUnit(seed, 0x1f123bb5) >= config.groupChance) {
    return null;
  }

  const size = BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.chunkSize;
  const centerX = chunk.x * size;
  const centerZ = chunk.z * size;
  let x: number;
  let z: number;
  if (isOriginChunk) {
    const angle = hashUnit(seed, 0x6d2b79f5) * Math.PI * 2;
    const radius = 11 + hashUnit(seed, 0x9e3779b1) * 5.5;
    x = Math.cos(angle) * radius;
    z = Math.sin(angle) * radius;
  } else {
    const jitterRadius = size * 0.32;
    x = centerX + signedHashUnit(seed, 0x85ebca6b) * jitterRadius;
    z = centerZ + signedHashUnit(seed, 0xc2b2ae35) * jitterRadius;
  }

  const countRange = config.maximumCountExclusive - config.minimumCount;
  const count = config.minimumCount + Math.floor(hashUnit(seed, 0x27d4eb2f) * countRange);
  return Object.freeze({ x, z, count, seed });
}

/** 将 Chunk 坐标与地图种子混合为非零 Uint32。 */
function hashSpawnCoordinate(chunkX: number, chunkZ: number, seed: number): number {
  let value = seed >>> 0
    ^ Math.imul(chunkX | 0, 0x45d9f3b)
    ^ Math.imul(chunkZ | 0, 0x119de1f3);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return value === 0 ? 0x6d2b79f5 : value >>> 0;
}

/** 从稳定种子与通道盐生成零到一的无状态随机值。 */
function hashUnit(seed: number, salt: number): number {
  let value = (seed ^ salt) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

/** 从稳定种子与通道盐生成负一到一的无状态随机值。 */
function signedHashUnit(seed: number, salt: number): number {
  return hashUnit(seed, salt) * 2 - 1;
}
