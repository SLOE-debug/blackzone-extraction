import {
  createSurfaceGeometry,
  GeometryIndexFormat,
  type StaticSurfaceBufferGeometry,
  type SurfaceBufferGeometry,
} from '../../../../core/geometry/buffer-geometry';
import { TREASURE_CHEST_LAYOUT } from '../model/treasure-chest-layout';
import { TREASURE_CHEST_BODY_GEOMETRY } from './treasure-chest-body-geometry';
import { TREASURE_CHEST_LID_GEOMETRY } from './treasure-chest-lid-geometry';

/** 宝箱体与可动箱盖共享的固定拓扑动态几何。 */
export interface TreasureChestBatchGeometry {
  readonly geometry: SurfaceBufferGeometry;
  readonly lidVertexOffset: number;
}

/** 将箱体和箱盖索引、颜色合成一次提交，并写入闭合姿态。 */
export function createTreasureChestBatchGeometry(): TreasureChestBatchGeometry {
  const body = TREASURE_CHEST_BODY_GEOMETRY;
  const lid = TREASURE_CHEST_LID_GEOMETRY;
  const geometry = createSurfaceGeometry(
    body.vertexCount + lid.vertexCount,
    body.indexCount + lid.indexCount,
    GeometryIndexFormat.Uint16,
  );
  geometry.commitCounts(geometry.maxVertices, geometry.maxIndices);
  copyStaticVertexStreams(body, geometry, 0);
  copyStaticIndices(body, geometry.index, 0, 0);
  copyStaticVertexStreams(lid, geometry, body.vertexCount);
  copyStaticIndices(lid, geometry.index, body.indexCount, body.vertexCount);
  const result = Object.freeze({ geometry, lidVertexOffset: body.vertexCount });
  writeTreasureChestLidPose(result, 0);
  return result;
}

/** 只重写箱盖区段的位置和法线，固定索引与颜色保持不变。 */
export function writeTreasureChestLidPose(
  batch: Readonly<TreasureChestBatchGeometry>,
  angleDegrees: number,
): void {
  const source = TREASURE_CHEST_LID_GEOMETRY;
  const target = batch.geometry;
  const angle = angleDegrees * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  for (let vertex = 0; vertex < source.vertexCount; vertex++) {
    const sourceOffset = vertex * 3;
    const targetOffset = (batch.lidVertexOffset + vertex) * 3;
    const x = source.positions[sourceOffset] ?? 0;
    const y = source.positions[sourceOffset + 1] ?? 0;
    const z = source.positions[sourceOffset + 2] ?? 0;
    target.positions[targetOffset] = x;
    target.positions[targetOffset + 1] = TREASURE_CHEST_LAYOUT.hingeY
      + y * cosine - z * sine;
    target.positions[targetOffset + 2] = TREASURE_CHEST_LAYOUT.hingeZ
      + y * sine + z * cosine;

    const normalX = source.normals[sourceOffset] ?? 0;
    const normalY = source.normals[sourceOffset + 1] ?? 0;
    const normalZ = source.normals[sourceOffset + 2] ?? 0;
    target.normals[targetOffset] = normalX;
    target.normals[targetOffset + 1] = normalY * cosine - normalZ * sine;
    target.normals[targetOffset + 2] = normalY * sine + normalZ * cosine;
  }
}

function copyStaticVertexStreams(
  source: StaticSurfaceBufferGeometry,
  target: SurfaceBufferGeometry,
  targetVertexOffset: number,
): void {
  target.positions.set(source.getPositionView(), targetVertexOffset * 3);
  target.normals.set(source.getNormalView(), targetVertexOffset * 3);
  target.colors.set(source.getColorView(), targetVertexOffset * 4);
}

function copyStaticIndices(
  source: StaticSurfaceBufferGeometry,
  target: Uint16Array | Uint32Array,
  targetIndexOffset: number,
  targetVertexOffset: number,
): void {
  const sourceIndices = source.getIndexView();
  for (let index = 0; index < sourceIndices.length; index++) {
    target[targetIndexOffset + index] = (sourceIndices[index] ?? 0) + targetVertexOffset;
  }
}
