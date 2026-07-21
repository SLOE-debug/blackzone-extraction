import { type VertexStreams } from '../../mesh/vertex-streams';
import { writeSequentialFlatNormalRange } from './sequential-flat-normal';
import { type FacetedCubicTubePlan } from './faceted-cubic-tube-plan';

const TANGENT_EPSILON = 0.000001;

/** 一条三次贝塞尔管体在当前帧的可变控制数据。 */
export interface MutableFacetedCubicTubeControlPoints {
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

/** 分面管体求值期间重复使用的逻辑截面顶点缓存。 */
export interface FacetedCubicTubeWorkspace {
  readonly logicalPositions: Float32Array;
}

/** 为指定管体计划创建一次性工作区。 */
export function createFacetedCubicTubeWorkspace(
  plan: FacetedCubicTubePlan,
): FacetedCubicTubeWorkspace {
  return Object.freeze({
    logicalPositions: new Float32Array(plan.logicalVertexCount * 3),
  });
}

/**
 * 把分面贝塞尔管体求值到独立三角顶点流。
 *
 * 工作区由上层 Evaluator 长期持有，单次求值不会创建对象或 TypedArray 子视图。
 */
export function evaluateFacetedCubicTube(
  plan: FacetedCubicTubePlan,
  streams: VertexStreams,
  vertexOffset: number,
  control: Readonly<MutableFacetedCubicTubeControlPoints>,
  workspace: FacetedCubicTubeWorkspace,
  writePositions: boolean,
  writeNormals: boolean,
): void {
  validateEvaluation(plan, streams, vertexOffset, control, workspace, writePositions, writeNormals);
  if (writePositions) {
    evaluateLogicalPositions(plan, control, workspace.logicalPositions);
    for (let vertex = 0; vertex < plan.vertexCount; vertex++) {
      const sourceOffset = (plan.sampleIds[vertex] ?? 0) * 3;
      const targetOffset = (vertexOffset + vertex) * 3;
      streams.positions[targetOffset] = workspace.logicalPositions[sourceOffset] ?? 0;
      streams.positions[targetOffset + 1] = workspace.logicalPositions[sourceOffset + 1] ?? 0;
      streams.positions[targetOffset + 2] = workspace.logicalPositions[sourceOffset + 2] ?? 0;
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

function evaluateLogicalPositions(
  plan: FacetedCubicTubePlan,
  control: Readonly<MutableFacetedCubicTubeControlPoints>,
  positions: Float32Array,
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
    const centerX = position0 * control.p0x + position1 * control.p1x
      + position2 * control.p2x + position3 * control.p3x;
    const centerY = position0 * control.p0y + position1 * control.p1y
      + position2 * control.p2y + position3 * control.p3y;
    const centerZ = position0 * control.p0z + position1 * control.p1z
      + position2 * control.p2z + position3 * control.p3z;
    const tangent0 = plan.tangentCoefficients[coefficientOffset] ?? 0;
    const tangent1 = plan.tangentCoefficients[coefficientOffset + 1] ?? 0;
    const tangent2 = plan.tangentCoefficients[coefficientOffset + 2] ?? 0;
    const tangent3 = plan.tangentCoefficients[coefficientOffset + 3] ?? 0;
    let tangentX = tangent0 * control.p0x + tangent1 * control.p1x
      + tangent2 * control.p2x + tangent3 * control.p3x;
    let tangentY = tangent0 * control.p0y + tangent1 * control.p1y
      + tangent2 * control.p2y + tangent3 * control.p3y;
    let tangentZ = tangent0 * control.p0z + tangent1 * control.p1z
      + tangent2 * control.p2z + tangent3 * control.p3z;
    const tangentLength = Math.hypot(tangentX, tangentY, tangentZ);
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

    const horizontalLength = Math.hypot(tangentX, tangentY);
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
    const baseRadius = control.startRadius
      + (control.endRadius - control.startRadius) * sample / plan.segmentCount;
    for (let radial = 0; radial < plan.radialCount; radial++) {
      const sampleId = sample * plan.radialCount + radial;
      const cosine = plan.radialCosines[sampleId] ?? 0;
      const sine = plan.radialSines[sampleId] ?? 0;
      const radius = baseRadius * (plan.radiusScales[sampleId] ?? 1);
      const radialX = sideX * cosine + upX * sine;
      const radialY = sideY * cosine + upY * sine;
      const radialZ = upZ * sine;
      const offset = sampleId * 3;
      positions[offset] = centerX + radialX * radius;
      positions[offset + 1] = centerY + radialY * radius;
      positions[offset + 2] = centerZ + radialZ * radius;
    }
  }
}

function validateEvaluation(
  plan: FacetedCubicTubePlan,
  streams: VertexStreams,
  vertexOffset: number,
  control: Readonly<MutableFacetedCubicTubeControlPoints>,
  workspace: FacetedCubicTubeWorkspace,
  writePositions: boolean,
  writeNormals: boolean,
): void {
  const values = [
    control.p0x, control.p0y, control.p0z,
    control.p1x, control.p1y, control.p1z,
    control.p2x, control.p2y, control.p2z,
    control.p3x, control.p3y, control.p3z,
    control.startRadius, control.endRadius,
  ];
  if (!values.every(Number.isFinite) || control.startRadius <= 0 || control.endRadius <= 0) {
    throw new Error('分面贝塞尔管体控制点和半径必须是有效有限数值。');
  }
  if (!Number.isInteger(vertexOffset)
    || vertexOffset < 0
    || streams.positions.length < (vertexOffset + plan.vertexCount) * 3
    || streams.normals.length < (vertexOffset + plan.vertexCount) * 3
    || workspace.logicalPositions.length !== plan.logicalVertexCount * 3) {
    throw new Error('分面贝塞尔管体目标流或工作区容量无效。');
  }
  if (writeNormals && !writePositions) {
    throw new Error('分面贝塞尔管体更新法线时必须同时更新位置。');
  }
}
