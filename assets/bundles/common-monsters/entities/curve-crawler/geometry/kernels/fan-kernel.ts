import { type VertexStreams } from '../../../../../../core/mesh/vertex-streams';
import { type FanSamplePlan } from './fan-sample-plan';

/**
 * 根据预编译的扇面方向直接写入死亡液体的动态 Position / Normal 流。
 *
 * @param plan 固定的液体扇面采样计划。
 * @param streams 当前批次可写顶点流。
 * @param vertexOffset 扇面首顶点在当前实体局部流中的偏移。
 * @param originX 实体世界 X 原点。
 * @param originY 实体世界 Y 原点。
 * @param heading 实体平面朝向弧度。
 * @param radiusX 当前液体局部 X 半径。
 * @param radiusY 当前液体局部 Y 半径。
 * @param radiusScales 当前实体各射线的不规则半径比例。
 * @param radiusScaleOffset 当前实体射线比例在 SoA 流中的起始偏移。
 * @param drain 当前液体收拢进度。
 * @param writePositions 是否允许改写位置流。
 * @param writeNormals 是否允许改写法线流。
 */
export function evaluateLiquidFan(
  plan: FanSamplePlan,
  streams: VertexStreams,
  vertexOffset: number,
  originX: number,
  originY: number,
  heading: number,
  radiusX: number,
  radiusY: number,
  radiusScales: Float32Array,
  radiusScaleOffset: number,
  drain: number,
  writePositions: boolean,
  writeNormals: boolean,
): void {
  const headingCosine = Math.cos(heading);
  const headingSine = Math.sin(heading);
  const sinkY = originY - radiusY * 1.35;
  const surfaceY = originY + (sinkY - originY) * drain;
  const surfaceZ = 0.035 * (1 - drain);
  const centerOffset = vertexOffset * 3;
  if (writePositions) {
    streams.positions[centerOffset] = originX;
    streams.positions[centerOffset + 1] = surfaceY;
    streams.positions[centerOffset + 2] = surfaceZ;
  }
  if (writeNormals) {
    streams.normals[centerOffset] = 0;
    streams.normals[centerOffset + 1] = 0;
    streams.normals[centerOffset + 2] = 1;
  }

  for (let ray = 0; ray < plan.rayCount; ray++) {
    const radiusScale = radiusScales[radiusScaleOffset + ray] ?? 1;
    const localX = (plan.rayCosines[ray] ?? 0) * radiusX * radiusScale;
    const localY = (plan.raySines[ray] ?? 0) * radiusY * radiusScale;
    const expandedX = originX + localX * headingCosine - localY * headingSine;
    const expandedY = originY + localX * headingSine + localY * headingCosine;
    const drainedX = originX + (expandedX - originX) * 0.18;
    const ringVertexOffset = vertexOffset + (plan.rayVertexOffsets[ray] ?? 0);
    const streamOffset = ringVertexOffset * 3;
    if (writePositions) {
      streams.positions[streamOffset] = expandedX + (drainedX - expandedX) * drain;
      streams.positions[streamOffset + 1] = expandedY + (sinkY - expandedY) * drain;
      streams.positions[streamOffset + 2] = surfaceZ;
    }
    if (writeNormals) {
      streams.normals[streamOffset] = 0;
      streams.normals[streamOffset + 1] = 0;
      streams.normals[streamOffset + 2] = 1;
    }
  }
}
