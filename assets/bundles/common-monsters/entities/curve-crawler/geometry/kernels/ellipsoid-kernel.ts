import { type VertexStreams } from '../../../../../../core/mesh/vertex-streams';
import { type EllipsoidSamplePlan } from './ellipsoid-sample-plan';

/**
 * 根据预编译单位方向把一个旋转椭球直接求值到动态 Position / Normal 流。
 *
 * @param plan 固定的椭球采样计划。
 * @param streams 当前批次可写顶点流。
 * @param vertexOffset 椭球首顶点在当前实体局部流中的偏移。
 * @param centerX 当前帧椭球中心的 X 坐标。
 * @param centerY 当前帧椭球中心的 Y 坐标。
 * @param centerZ 当前帧椭球中心的 Z 坐标。
 * @param radiusX 当前帧局部 X 半径，必须为正数。
 * @param radiusY 当前帧局部 Y 半径，必须为正数。
 * @param radiusZ 当前帧局部 Z 半径，必须为正数。
 * @param rotation 绕 Z 轴的当前旋转弧度。
 * @param writePositions 是否允许改写位置流。
 * @param writeNormals 是否允许改写法线流。
 */
export function evaluateEllipsoid(
  plan: EllipsoidSamplePlan,
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
  const rotationCosine = Math.cos(rotation);
  const rotationSine = Math.sin(rotation);
  for (let vertex = 0; vertex < plan.vertexCount; vertex++) {
    const directionOffset = vertex * 3;
    const unitX = plan.unitDirections[directionOffset] ?? 0;
    const unitY = plan.unitDirections[directionOffset + 1] ?? 0;
    const unitZ = plan.unitDirections[directionOffset + 2] ?? 0;
    const localX = unitX * radiusX;
    const localY = unitY * radiusY;
    const normalX = unitX / radiusX;
    const normalY = unitY / radiusY;
    const normalZ = unitZ / radiusZ;
    const normalLength = Math.sqrt(
      normalX * normalX + normalY * normalY + normalZ * normalZ,
    );
    const normalizedX = normalX / normalLength;
    const normalizedY = normalY / normalLength;
    const normalizedZ = normalZ / normalLength;
    const streamOffset = (vertexOffset + vertex) * 3;
    if (writePositions) {
      streams.positions[streamOffset] = centerX + localX * rotationCosine - localY * rotationSine;
      streams.positions[streamOffset + 1] = centerY + localX * rotationSine + localY * rotationCosine;
      streams.positions[streamOffset + 2] = centerZ + unitZ * radiusZ;
    }
    if (writeNormals) {
      streams.normals[streamOffset] = normalizedX * rotationCosine - normalizedY * rotationSine;
      streams.normals[streamOffset + 1] = normalizedX * rotationSine + normalizedY * rotationCosine;
      streams.normals[streamOffset + 2] = normalizedZ;
    }
  }
}
