import {
  createUnlitColorGeometry,
  GeometryIndexFormat,
  type StaticSurfaceBufferGeometry,
  type UnlitColorBufferGeometry,
} from '../../../../core/geometry/buffer-geometry';

/** 不依赖 Cocos 类型的三维仿射变换最小契约。 */
export interface DroppedEquipmentAffineTransform {
  readonly m00: number;
  readonly m01: number;
  readonly m02: number;
  readonly m04: number;
  readonly m05: number;
  readonly m06: number;
  readonly m08: number;
  readonly m09: number;
  readonly m10: number;
  readonly m12: number;
  readonly m13: number;
  readonly m14: number;
}

/** 多类掉落装备合并后的固定索引布局。 */
export interface DroppedEquipmentBatchGeometry {
  readonly geometry: UnlitColorBufferGeometry;
  readonly sources: readonly StaticSurfaceBufferGeometry[];
  readonly vertexOffsets: readonly number[];
}

/** 创建一次掉落批次的连续顶点区段并写入固定 Color / Index 流。 */
export function createDroppedEquipmentBatchGeometry(
  sources: readonly StaticSurfaceBufferGeometry[],
): DroppedEquipmentBatchGeometry {
  if (sources.length === 0) {
    throw new Error('掉落装备批次至少需要一份源几何。');
  }
  const vertexOffsets = createVertexOffsets(sources);
  const vertexCount = sources.reduce((total, source) => total + source.vertexCount, 0);
  const indexCount = sources.reduce((total, source) => total + source.indexCount, 0);
  const geometry = createUnlitColorGeometry(
    vertexCount,
    indexCount,
    GeometryIndexFormat.Uint32,
  );
  geometry.commitCounts(vertexCount, indexCount);
  writeFixedStreams(sources, vertexOffsets, geometry);
  return Object.freeze({
    geometry,
    sources: Object.freeze([...sources]),
    vertexOffsets,
  });
}

/** 把一份源几何按通用仿射矩阵写入目标顶点区段。 */
export function writeDroppedEquipmentBatchPose(
  source: StaticSurfaceBufferGeometry,
  target: UnlitColorBufferGeometry,
  targetVertexOffset: number,
  visible: boolean,
  matrix: Readonly<DroppedEquipmentAffineTransform>,
): void {
  for (let vertex = 0; vertex < source.vertexCount; vertex++) {
    const sourceOffset = vertex * 3;
    const targetOffset = (targetVertexOffset + vertex) * 3;
    const x = source.positions[sourceOffset] ?? 0;
    const y = source.positions[sourceOffset + 1] ?? 0;
    const z = source.positions[sourceOffset + 2] ?? 0;
    target.positions[targetOffset] = visible
      ? matrix.m00 * x + matrix.m04 * y + matrix.m08 * z + matrix.m12
      : matrix.m12;
    target.positions[targetOffset + 1] = visible
      ? matrix.m01 * x + matrix.m05 * y + matrix.m09 * z + matrix.m13
      : matrix.m13;
    target.positions[targetOffset + 2] = visible
      ? matrix.m02 * x + matrix.m06 * y + matrix.m10 * z + matrix.m14
      : matrix.m14;
  }
}

function createVertexOffsets(
  sources: readonly StaticSurfaceBufferGeometry[],
): readonly number[] {
  const offsets: number[] = [];
  let vertexOffset = 0;
  for (const source of sources) {
    offsets.push(vertexOffset);
    vertexOffset += source.vertexCount;
  }
  return Object.freeze(offsets);
}

function writeFixedStreams(
  sources: readonly StaticSurfaceBufferGeometry[],
  vertexOffsets: readonly number[],
  target: UnlitColorBufferGeometry,
): void {
  let targetIndexOffset = 0;
  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
    const source = sources[sourceIndex];
    const vertexOffset = vertexOffsets[sourceIndex];
    if (source === undefined || vertexOffset === undefined) {
      throw new Error('掉落装备固定流区段不存在。');
    }
    target.colors.set(source.getColorView(), vertexOffset * 4);
    const indices = source.getIndexView();
    for (let index = 0; index < indices.length; index++) {
      target.index[targetIndexOffset + index] = (indices[index] ?? 0) + vertexOffset;
    }
    targetIndexOffset += indices.length;
  }
}
