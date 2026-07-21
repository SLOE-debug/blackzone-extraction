import {
  createUnlitColorGeometry,
  GeometryIndexFormat,
  type UnlitColorBufferGeometry,
} from '../../../../core/geometry/buffer-geometry';
import { type TreasureChestBatchGeometry } from './treasure-chest-batch-geometry';

/** 为共享宝箱箱体批次创建固定容量拓扑。 */
export function createSharedTreasureChestBodyGeometry(
  source: Readonly<TreasureChestBatchGeometry>,
  capacity: number,
): UnlitColorBufferGeometry {
  validateCapacity(capacity);
  const sourceGeometry = source.geometry;
  const target = createUnlitColorGeometry(
    sourceGeometry.vertexCount * capacity,
    sourceGeometry.indexCount * capacity,
    GeometryIndexFormat.Uint32,
  );
  target.commitCounts(target.maxVertices, target.maxIndices);
  copyRepeatedIndices(
    sourceGeometry.getIndexView(),
    sourceGeometry.vertexCount,
    sourceGeometry.indexCount,
    capacity,
    target.index,
  );
  return target;
}

/** 为共享宝箱信标批次创建固定容量拓扑。 */
export function createSharedTreasureChestBeaconGeometry(
  source: UnlitColorBufferGeometry,
  capacity: number,
): UnlitColorBufferGeometry {
  validateCapacity(capacity);
  const target = createUnlitColorGeometry(
    source.vertexCount * capacity,
    source.indexCount * capacity,
    GeometryIndexFormat.Uint32,
  );
  target.commitCounts(target.maxVertices, target.maxIndices);
  copyRepeatedIndices(
    source.getIndexView(),
    source.vertexCount,
    source.indexCount,
    capacity,
    target.index,
  );
  return target;
}

/** 把一个局部箱体姿态旋转并平移到共享世界空间槽位。 */
export function writeSharedTreasureChestBody(
  source: Readonly<TreasureChestBatchGeometry>,
  target: UnlitColorBufferGeometry,
  slot: number,
  x: number,
  y: number,
  z: number,
  heading: number,
  writeColors: boolean,
): void {
  const sourceGeometry = source.geometry;
  validateSlot(target.vertexCount, sourceGeometry.vertexCount, slot);
  const cosine = Math.cos(heading);
  const sine = Math.sin(heading);
  const targetVertexOffset = slot * sourceGeometry.vertexCount;
  for (let vertex = 0; vertex < sourceGeometry.vertexCount; vertex++) {
    const sourceOffset = vertex * 3;
    const targetOffset = (targetVertexOffset + vertex) * 3;
    const localX = sourceGeometry.positions[sourceOffset] ?? 0;
    const localY = sourceGeometry.positions[sourceOffset + 1] ?? 0;
    const localZ = sourceGeometry.positions[sourceOffset + 2] ?? 0;
    target.positions[targetOffset] = x + localX * cosine + localZ * sine;
    target.positions[targetOffset + 1] = y + localY;
    target.positions[targetOffset + 2] = z - localX * sine + localZ * cosine;
  }
  if (writeColors) {
    target.colors.set(
      sourceGeometry.colors,
      targetVertexOffset * 4,
    );
  }
}

/** 把一个局部信标姿态旋转并平移到共享世界空间槽位。 */
export function writeSharedTreasureChestBeacon(
  source: UnlitColorBufferGeometry,
  target: UnlitColorBufferGeometry,
  slot: number,
  x: number,
  y: number,
  z: number,
  heading: number,
): void {
  validateSlot(target.vertexCount, source.vertexCount, slot);
  const cosine = Math.cos(heading);
  const sine = Math.sin(heading);
  const targetVertexOffset = slot * source.vertexCount;
  for (let vertex = 0; vertex < source.vertexCount; vertex++) {
    const sourceOffset = vertex * 3;
    const targetOffset = (targetVertexOffset + vertex) * 3;
    const localX = source.positions[sourceOffset] ?? 0;
    const localY = source.positions[sourceOffset + 1] ?? 0;
    const localZ = source.positions[sourceOffset + 2] ?? 0;
    target.positions[targetOffset] = x + localX * cosine + localZ * sine;
    target.positions[targetOffset + 1] = y + localY;
    target.positions[targetOffset + 2] = z - localX * sine + localZ * cosine;
  }
  target.colors.set(source.colors, targetVertexOffset * 4);
}

/** 把箱体容量余量收拢为不可见退化顶点。 */
export function collapseSharedTreasureChestBodies(
  geometry: UnlitColorBufferGeometry,
  verticesPerChest: number,
  firstSlot: number,
): void {
  const firstVertex = firstSlot * verticesPerChest;
  geometry.positions.fill(0, firstVertex * 3);
  geometry.colors.fill(0, firstVertex * 4);
}

/** 把信标容量余量收拢为不可见退化顶点。 */
export function collapseSharedTreasureChestBeacons(
  geometry: UnlitColorBufferGeometry,
  verticesPerChest: number,
  firstSlot: number,
): void {
  const firstVertex = firstSlot * verticesPerChest;
  geometry.positions.fill(0, firstVertex * 3);
  geometry.colors.fill(0, firstVertex * 4);
}

function copyRepeatedIndices(
  source: Uint16Array | Uint32Array,
  verticesPerInstance: number,
  indicesPerInstance: number,
  capacity: number,
  target: Uint32Array,
): void {
  for (let slot = 0; slot < capacity; slot++) {
    const vertexOffset = slot * verticesPerInstance;
    const indexOffset = slot * indicesPerInstance;
    for (let index = 0; index < indicesPerInstance; index++) {
      target[indexOffset + index] = (source[index] ?? 0) + vertexOffset;
    }
  }
}

function validateCapacity(capacity: number): void {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error('共享宝箱批次容量必须是正整数。');
  }
}

function validateSlot(totalVertices: number, verticesPerChest: number, slot: number): void {
  const capacity = totalVertices / verticesPerChest;
  if (!Number.isInteger(slot) || slot < 0 || slot >= capacity) {
    throw new Error('共享宝箱批次槽位越界。');
  }
}
