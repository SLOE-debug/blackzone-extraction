import { BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG } from '../environment/model/battlefield-environment-config';
import { BATTLEFIELD_LAYOUT } from '../model/battlefield-layout';

/** 地面补丁在世界格点中的定位信息。 */
export interface BattlefieldGroundPatchFrame {
  readonly centerWorldX: number;
  readonly centerWorldZ: number;
  readonly firstGlobalColumn: number;
  readonly firstGlobalRow: number;
}

/** 可复用的地面格点采样结果。 */
export interface BattlefieldGroundPoint {
  x: number;
  y: number;
  z: number;
}

/** 可复用的地表色域采样结果。 */
export interface BattlefieldGroundSurfaceSample {
  macroVariation: number;
  soilCoverage: number;
  mossCoverage: number;
  facetVariation: number;
}

const HASH_SCALE = 1 / 0xffffffff;
const GROUND_WIDTH = BATTLEFIELD_LAYOUT.groundHalfExtent * 2;
const CELL_SIZE_X = GROUND_WIDTH / BATTLEFIELD_LAYOUT.groundColumns;
const CELL_SIZE_Z = GROUND_WIDTH / BATTLEFIELD_LAYOUT.groundRows;
const CELLS_PER_CHUNK_X = BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.chunkSize / CELL_SIZE_X;
const CELLS_PER_CHUNK_Z = BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.chunkSize / CELL_SIZE_Z;
const HALF_COLUMN_COUNT = BATTLEFIELD_LAYOUT.groundColumns / 2;
const HALF_ROW_COUNT = BATTLEFIELD_LAYOUT.groundRows / 2;
const VERTEX_JITTER = 0.68;

validateGroundLattice();

/** 根据环境 Chunk 创建能够和相邻补丁复现同一世界格点的定位帧。 */
export function createBattlefieldGroundPatchFrame(
  centerChunkX: number,
  centerChunkZ: number,
): BattlefieldGroundPatchFrame {
  if (!Number.isInteger(centerChunkX) || !Number.isInteger(centerChunkZ)) {
    throw new Error('地面补丁中心必须使用整数 Chunk 坐标。');
  }

  const centerGlobalColumn = centerChunkX * CELLS_PER_CHUNK_X;
  const centerGlobalRow = centerChunkZ * CELLS_PER_CHUNK_Z;
  return {
    centerWorldX: centerChunkX * BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.chunkSize,
    centerWorldZ: centerChunkZ * BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.chunkSize,
    firstGlobalColumn: centerGlobalColumn - HALF_COLUMN_COUNT,
    firstGlobalRow: centerGlobalRow - HALF_ROW_COUNT,
  };
}

/**
 * 采样一个确定性的世界地面格点。
 *
 * 高度幅度刻意保持在厘米级，玩法仍使用平面碰撞；横向扰动只负责打散规则瓷砖感。
 */
export function sampleBattlefieldGroundPoint(
  globalColumn: number,
  globalRow: number,
  frame: Readonly<BattlefieldGroundPatchFrame>,
  target: BattlefieldGroundPoint,
): void {
  const isWorldOrigin = globalColumn === 0 && globalRow === 0;
  const baseWorldX = globalColumn * CELL_SIZE_X;
  const baseWorldZ = globalRow * CELL_SIZE_Z;
  const jitterX = isWorldOrigin
    ? 0
    : sampleSignedHash(globalColumn, globalRow, 0x2f6e2b1) * VERTEX_JITTER;
  const jitterZ = isWorldOrigin
    ? 0
    : sampleSignedHash(globalColumn, globalRow, 0x53a9d17) * VERTEX_JITTER;
  const worldX = baseWorldX + jitterX;
  const worldZ = baseWorldZ + jitterZ;
  const macroHeight = sampleSignedValueNoise(baseWorldX, baseWorldZ, 43, 0x16bc4d3);
  const mesoHeight = sampleSignedValueNoise(baseWorldX, baseWorldZ, 17, 0x6c91f07);
  const facetHeight = sampleSignedHash(globalColumn, globalRow, 0x41e73a9);

  target.x = worldX - frame.centerWorldX;
  target.y = isWorldOrigin
    ? 0
    : macroHeight * 0.018 + mesoHeight * 0.011 + facetHeight * 0.004;
  target.z = worldZ - frame.centerWorldZ;
}

/** 按世界坐标采样不规则土壤、苔藓与分面色差，避免任何按顶点编号循环的条纹。 */
export function sampleBattlefieldGroundSurface(
  worldX: number,
  worldZ: number,
  target: BattlefieldGroundSurfaceSample,
): void {
  target.macroVariation = sampleSignedValueNoise(worldX, worldZ, 54, 0x37d55bd);
  target.soilCoverage = smoothRange(
    sampleUnitValueNoise(worldX + 19, worldZ - 11, 86, 0x5a14c8f),
    0.52,
    0.78,
  );
  target.mossCoverage = smoothRange(
    sampleUnitValueNoise(worldX - 7, worldZ + 23, 31, 0x72cf913),
    0.57,
    0.82,
  ) * (1 - target.soilCoverage * 0.72);
  target.facetVariation = sampleSignedValueNoise(worldX, worldZ, 6.5, 0x24a7e61);
}

function sampleSignedValueNoise(
  worldX: number,
  worldZ: number,
  scale: number,
  seed: number,
): number {
  return sampleUnitValueNoise(worldX, worldZ, scale, seed) * 2 - 1;
}

function sampleUnitValueNoise(
  worldX: number,
  worldZ: number,
  scale: number,
  seed: number,
): number {
  const scaledX = worldX / scale;
  const scaledZ = worldZ / scale;
  const cellX = Math.floor(scaledX);
  const cellZ = Math.floor(scaledZ);
  const blendX = smoothStep(scaledX - cellX);
  const blendZ = smoothStep(scaledZ - cellZ);
  const lower = lerp(
    sampleUnitHash(cellX, cellZ, seed),
    sampleUnitHash(cellX + 1, cellZ, seed),
    blendX,
  );
  const upper = lerp(
    sampleUnitHash(cellX, cellZ + 1, seed),
    sampleUnitHash(cellX + 1, cellZ + 1, seed),
    blendX,
  );
  return lerp(lower, upper, blendZ);
}

function sampleSignedHash(x: number, z: number, seed: number): number {
  return sampleUnitHash(x, z, seed) * 2 - 1;
}

function sampleUnitHash(x: number, z: number, seed: number): number {
  let hash = Math.imul(x, 0x1f123bb5) ^ Math.imul(z, 0x5f356495) ^ seed;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 15), 0x45d9f3b);
  return ((hash ^ (hash >>> 16)) >>> 0) * HASH_SCALE;
}

function smoothStep(value: number): number {
  return value * value * (3 - value * 2);
}

function smoothRange(value: number, lower: number, upper: number): number {
  const normalized = Math.max(0, Math.min(1, (value - lower) / (upper - lower)));
  return smoothStep(normalized);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function validateGroundLattice(): void {
  const values = [
    CELL_SIZE_X,
    CELL_SIZE_Z,
    CELLS_PER_CHUNK_X,
    CELLS_PER_CHUNK_Z,
    HALF_COLUMN_COUNT,
    HALF_ROW_COUNT,
  ];
  if (!values.every(Number.isFinite)
    || !Number.isInteger(CELLS_PER_CHUNK_X)
    || !Number.isInteger(CELLS_PER_CHUNK_Z)
    || !Number.isInteger(HALF_COLUMN_COUNT)
    || !Number.isInteger(HALF_ROW_COUNT)) {
    throw new Error('战场地面尺寸必须形成可按 Chunk 整格平移的偶数格点阵列。');
  }
  if ((CELLS_PER_CHUNK_X & 1) !== 0 || (CELLS_PER_CHUNK_Z & 1) !== 0) {
    throw new Error('地面每个 Chunk 必须跨越偶数格，才能保持交替三角拓扑连续。');
  }
}
