import { type VertexStreams } from '../../../../../../core/mesh/vertex-streams';
import { type CubicTubeSamplePlan } from './cubic-tube-sample-plan';

const TANGENT_EPSILON = 0.000001;

/**
 * 一条三次贝塞尔管体在当前帧的可变控制数据。
 *
 * 实例由领域 Evaluator 持有并反复复用，禁止在每条腿或每帧临时创建。
 */
export interface MutableCubicTubeControlPoints {
  p0x: number;
  p0y: number;
  p0z: number;
  p1x: number;
  p1y: number;
  p1z: number;
  p2x: number;
  p2y: number;
  p2z: number;
  p3x: number;
  p3y: number;
  p3z: number;
  startRadius: number;
  endRadius: number;
}

/**
 * 根据预编译采样表把一条贝塞尔管体直接求值到动态 Position / Normal 流。
 *
 * @param plan 固定的曲线、径向和索引采样计划。
 * @param streams 当前批次可写顶点流。
 * @param vertexOffset 管体首顶点在当前实体局部流中的偏移。
 * @param control 当前帧已经计算好的控制点和两端半径。
 * @param writePositions 是否允许改写位置流。
 * @param writeNormals 是否允许改写法线流。
 */
export function evaluateCubicTube(
  plan: CubicTubeSamplePlan,
  streams: VertexStreams,
  vertexOffset: number,
  control: Readonly<MutableCubicTubeControlPoints>,
  writePositions: boolean,
  writeNormals: boolean,
): void {
  let previousTangentX = 1;
  let previousTangentY = 0;
  let previousTangentZ = 0;
  let previousSideX = 0;
  let previousSideY = 1;

  for (let sample = 0; sample <= plan.segmentCount; sample++) {
    const coefficientOffset = sample * 4;
    const position0 = plan.positionCoefficients[coefficientOffset] ?? 0;
    const position1 = plan.positionCoefficients[coefficientOffset + 1] ?? 0;
    const position2 = plan.positionCoefficients[coefficientOffset + 2] ?? 0;
    const position3 = plan.positionCoefficients[coefficientOffset + 3] ?? 0;
    const tangent0 = plan.tangentCoefficients[coefficientOffset] ?? 0;
    const tangent1 = plan.tangentCoefficients[coefficientOffset + 1] ?? 0;
    const tangent2 = plan.tangentCoefficients[coefficientOffset + 2] ?? 0;
    const tangent3 = plan.tangentCoefficients[coefficientOffset + 3] ?? 0;
    const centerX = position0 * control.p0x
      + position1 * control.p1x
      + position2 * control.p2x
      + position3 * control.p3x;
    const centerY = position0 * control.p0y
      + position1 * control.p1y
      + position2 * control.p2y
      + position3 * control.p3y;
    const centerZ = position0 * control.p0z
      + position1 * control.p1z
      + position2 * control.p2z
      + position3 * control.p3z;

    let tangentX = tangent0 * control.p0x
      + tangent1 * control.p1x
      + tangent2 * control.p2x
      + tangent3 * control.p3x;
    let tangentY = tangent0 * control.p0y
      + tangent1 * control.p1y
      + tangent2 * control.p2y
      + tangent3 * control.p3y;
    let tangentZ = tangent0 * control.p0z
      + tangent1 * control.p1z
      + tangent2 * control.p2z
      + tangent3 * control.p3z;
    const tangentLength = Math.sqrt(
      tangentX * tangentX + tangentY * tangentY + tangentZ * tangentZ,
    );
    if (tangentLength > TANGENT_EPSILON) {
      tangentX /= tangentLength;
      tangentY /= tangentLength;
      tangentZ /= tangentLength;
      previousTangentX = tangentX;
      previousTangentY = tangentY;
      previousTangentZ = tangentZ;
    } else {
      tangentX = previousTangentX;
      tangentY = previousTangentY;
      tangentZ = previousTangentZ;
    }

    const horizontalLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
    let sideX = previousSideX;
    let sideY = previousSideY;
    if (horizontalLength > TANGENT_EPSILON) {
      sideX = -tangentY / horizontalLength;
      sideY = tangentX / horizontalLength;
      previousSideX = sideX;
      previousSideY = sideY;
    }
    const upX = -tangentZ * sideY;
    const upY = tangentZ * sideX;
    const upZ = tangentX * sideY - tangentY * sideX;
    const radius = control.startRadius
      + (control.endRadius - control.startRadius) * sample / plan.segmentCount;

    const ringVertexOffset = vertexOffset + sample * plan.radialCount;
    for (let radial = 0; radial < plan.radialCount; radial++) {
      const cosine = plan.radialCosines[radial] ?? 0;
      const sine = plan.radialSines[radial] ?? 0;
      const normalX = sideX * cosine + upX * sine;
      const normalY = sideY * cosine + upY * sine;
      const normalZ = upZ * sine;
      const streamOffset = (ringVertexOffset + radial) * 3;
      if (writePositions) {
        streams.positions[streamOffset] = centerX + normalX * radius;
        streams.positions[streamOffset + 1] = centerY + normalY * radius;
        streams.positions[streamOffset + 2] = centerZ + normalZ * radius;
      }
      if (writeNormals) {
        streams.normals[streamOffset] = normalX;
        streams.normals[streamOffset + 1] = normalY;
        streams.normals[streamOffset + 2] = normalZ;
      }
    }
  }
}
