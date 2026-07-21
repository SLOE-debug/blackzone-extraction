import { type VertexStreams } from '../../mesh/vertex-streams';
import { writeSequentialFlatNormalRange } from './sequential-flat-normal';
import { type FacetedEllipsoidPlan } from './faceted-ellipsoid-plan';

/**
 * 把确定性不规则分面椭球直接求值到动态 Position / Normal 流。
 *
 * 法线依赖当前姿态位置，因此请求法线时必须同时写入位置。
 */
export function evaluateFacetedEllipsoid(
  plan: FacetedEllipsoidPlan,
  streams: VertexStreams,
  vertexOffset: number,
  centerX: number,
  centerY: number,
  centerZ: number,
  radiusX: number,
  radiusY: number,
  radiusZ: number,
  rotation: number,
  writePositions: boolean,
  writeNormals: boolean,
): void {
  if (![centerX, centerY, centerZ, radiusX, radiusY, radiusZ, rotation].every(Number.isFinite)
    || radiusX <= 0
    || radiusY <= 0
    || radiusZ <= 0) {
    throw new Error('分面椭球中心、半径和旋转必须是有效有限数值。');
  }
  if (writeNormals && !writePositions) {
    throw new Error('分面椭球更新法线时必须同时更新位置。');
  }

  if (writePositions) {
    const rotationCosine = Math.cos(rotation);
    const rotationSine = Math.sin(rotation);
    for (let vertex = 0; vertex < plan.vertexCount; vertex++) {
      const directionOffset = vertex * 3;
      const scale = plan.radiusScales[vertex] ?? 1;
      const localX = (plan.unitDirections[directionOffset] ?? 0) * radiusX * scale;
      const localY = (plan.unitDirections[directionOffset + 1] ?? 0) * radiusY * scale;
      const localZ = (plan.unitDirections[directionOffset + 2] ?? 0) * radiusZ * scale;
      const streamOffset = (vertexOffset + vertex) * 3;
      streams.positions[streamOffset] = centerX
        + localX * rotationCosine - localY * rotationSine;
      streams.positions[streamOffset + 1] = centerY
        + localX * rotationSine + localY * rotationCosine;
      streams.positions[streamOffset + 2] = centerZ + localZ;
    }
  }
  if (writeNormals) {
    writeSequentialFlatNormalRange(
      streams.positions,
      streams.normals,
      vertexOffset,
      plan.vertexCount,
    );
  }
}
