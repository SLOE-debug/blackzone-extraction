/** 用于 Map 索引的 Chunk 坐标强类型键。 */
export type ChunkCoordinateKey = string & { readonly __chunkCoordinateKey: unique symbol };

/** 与具体场景和实体类型无关的二维整数 Chunk 坐标。 */
export interface ChunkCoordinate {
  readonly x: number;
  readonly z: number;
}

/** 创建经过整数校验且不可变的 Chunk 坐标。 */
export function createChunkCoordinate(x: number, z: number): Readonly<ChunkCoordinate> {
  assertChunkCoordinateValues(x, z);
  return Object.freeze({
    x: Object.is(x, -0) ? 0 : x,
    z: Object.is(z, -0) ? 0 : z,
  });
}

/** 把 Chunk 坐标转换为只由本模块构造的稳定键。 */
export function toChunkCoordinateKey(
  coordinate: Readonly<ChunkCoordinate>,
): ChunkCoordinateKey {
  assertChunkCoordinateValues(coordinate.x, coordinate.z);
  const x = Object.is(coordinate.x, -0) ? 0 : coordinate.x;
  const z = Object.is(coordinate.z, -0) ? 0 : coordinate.z;
  return `${x}:${z}` as ChunkCoordinateKey;
}

/** 判断两个 Chunk 坐标是否指向同一个整数格。 */
export function isSameChunkCoordinate(
  left: Readonly<ChunkCoordinate>,
  right: Readonly<ChunkCoordinate>,
): boolean {
  return left.x === right.x && left.z === right.z;
}

function assertChunkCoordinateValues(x: number, z: number): void {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(z)) {
    throw new Error('Chunk 坐标必须使用安全整数。');
  }
}
