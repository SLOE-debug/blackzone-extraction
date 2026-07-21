import { TAU } from '../../math/scalar';
import { type MeshPlan } from '../../mesh/mesh-plan';

/** 分面三次贝塞尔管体的固定拓扑与确定性轮廓参数。 */
export interface FacetedCubicTubePlan extends MeshPlan {
  readonly segmentCount: number;
  readonly radialCount: number;
  /** 未展开接缝前的曲线截面顶点数量。 */
  readonly logicalVertexCount: number;
  /** 每个曲线采样点对应四个控制点的位置贝塞尔系数。 */
  readonly positionCoefficients: Float32Array;
  /** 每个曲线采样点对应四个控制点的切线贝塞尔系数。 */
  readonly tangentCoefficients: Float32Array;
  /** 每个逻辑截面顶点的单位圆余弦。 */
  readonly radialCosines: Float32Array;
  /** 每个逻辑截面顶点的单位圆正弦。 */
  readonly radialSines: Float32Array;
  /** 每个逻辑截面顶点的确定性半径比例。 */
  readonly radiusScales: Float32Array;
  /** 每个独立三角顶点对应的逻辑截面顶点。 */
  readonly sampleIds: Uint16Array;
}

/** 编译分面三次贝塞尔管体所需的完整风格参数。 */
export interface FacetedCubicTubePlanSpec {
  readonly segmentCount: number;
  readonly radialCount: number;
  readonly radialJitter: number;
  readonly ringTwist: number;
  readonly seed: number;
}

/** 返回展开为独立三角形后的分面管体拓扑规模。 */
export function getFacetedCubicTubeTopologyMetrics(
  segmentCount: number,
  radialCount: number,
): Readonly<{ vertexCount: number; indexCount: number }> {
  validateSegments(segmentCount, radialCount);
  const sequentialVertexCount = segmentCount * radialCount * 6;
  return Object.freeze({
    vertexCount: sequentialVertexCount,
    indexCount: sequentialVertexCount,
  });
}

/** 编译带错角截面和确定性轮廓扰动的硬分面三次贝塞尔管体。 */
export function compileFacetedCubicTubePlan(
  spec: Readonly<FacetedCubicTubePlanSpec>,
): FacetedCubicTubePlan {
  validateSpec(spec);
  const metrics = getFacetedCubicTubeTopologyMetrics(spec.segmentCount, spec.radialCount);
  const sampleCount = spec.segmentCount + 1;
  const logicalVertexCount = sampleCount * spec.radialCount;
  if (metrics.vertexCount > 0xffff || logicalVertexCount > 0xffff) {
    throw new Error('分面贝塞尔管体局部顶点数量超过 Uint16 索引范围。');
  }

  const positionCoefficients = new Float32Array(sampleCount * 4);
  const tangentCoefficients = new Float32Array(sampleCount * 4);
  for (let sample = 0; sample < sampleCount; sample++) {
    writeCubicCoefficients(
      positionCoefficients,
      tangentCoefficients,
      sample,
      sample / spec.segmentCount,
    );
  }

  const radialCosines = new Float32Array(logicalVertexCount);
  const radialSines = new Float32Array(logicalVertexCount);
  const radiusScales = new Float32Array(logicalVertexCount);
  for (let sample = 0; sample < sampleCount; sample++) {
    const twist = signedHash(spec.seed, sample * 41 + 7) * spec.ringTwist;
    for (let radial = 0; radial < spec.radialCount; radial++) {
      const sampleId = sample * spec.radialCount + radial;
      const angle = radial / spec.radialCount * TAU + twist;
      radialCosines[sampleId] = Math.cos(angle);
      radialSines[sampleId] = Math.sin(angle);
      radiusScales[sampleId] = 1
        + signedHash(spec.seed, sampleId * 59 + 23) * spec.radialJitter;
    }
  }

  const sampleIds = new Uint16Array(metrics.vertexCount);
  let vertexOffset = 0;
  for (let segment = 0; segment < spec.segmentCount; segment++) {
    const currentRing = segment * spec.radialCount;
    const nextRing = currentRing + spec.radialCount;
    for (let radial = 0; radial < spec.radialCount; radial++) {
      const nextRadial = (radial + 1) % spec.radialCount;
      vertexOffset = appendTriangle(
        sampleIds,
        vertexOffset,
        currentRing + radial,
        currentRing + nextRadial,
        nextRing + radial,
      );
      vertexOffset = appendTriangle(
        sampleIds,
        vertexOffset,
        currentRing + nextRadial,
        nextRing + nextRadial,
        nextRing + radial,
      );
    }
  }
  if (vertexOffset !== metrics.vertexCount) {
    throw new Error('分面贝塞尔管体编译后的顶点数量与拓扑计划不一致。');
  }

  const indices = new Uint16Array(metrics.indexCount);
  for (let index = 0; index < indices.length; index++) {
    indices[index] = index;
  }
  return Object.freeze({
    segmentCount: spec.segmentCount,
    radialCount: spec.radialCount,
    logicalVertexCount,
    vertexCount: metrics.vertexCount,
    indexCount: metrics.indexCount,
    positionCoefficients,
    tangentCoefficients,
    radialCosines,
    radialSines,
    radiusScales,
    sampleIds,
    indices,
  });
}

function writeCubicCoefficients(
  positions: Float32Array,
  tangents: Float32Array,
  sample: number,
  t: number,
): void {
  const inverse = 1 - t;
  const inverseSquared = inverse * inverse;
  const tSquared = t * t;
  const offset = sample * 4;
  positions[offset] = inverseSquared * inverse;
  positions[offset + 1] = 3 * inverseSquared * t;
  positions[offset + 2] = 3 * inverse * tSquared;
  positions[offset + 3] = tSquared * t;
  tangents[offset] = -3 * inverseSquared;
  tangents[offset + 1] = 3 * inverseSquared - 6 * inverse * t;
  tangents[offset + 2] = 6 * inverse * t - 3 * tSquared;
  tangents[offset + 3] = 3 * tSquared;
}

function appendTriangle(
  sampleIds: Uint16Array,
  vertexOffset: number,
  a: number,
  b: number,
  c: number,
): number {
  sampleIds[vertexOffset] = a;
  sampleIds[vertexOffset + 1] = b;
  sampleIds[vertexOffset + 2] = c;
  return vertexOffset + 3;
}

function signedHash(seed: number, salt: number): number {
  let value = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 0xffffffff * 2 - 1;
}

function validateSpec(spec: Readonly<FacetedCubicTubePlanSpec>): void {
  validateSegments(spec.segmentCount, spec.radialCount);
  if (!Number.isFinite(spec.radialJitter)
    || spec.radialJitter < 0
    || spec.radialJitter > 0.35
    || !Number.isFinite(spec.ringTwist)
    || spec.ringTwist < 0
    || spec.ringTwist > Math.PI / 3
    || !Number.isInteger(spec.seed)) {
    throw new Error('分面贝塞尔管体扰动、错角和 seed 配置无效。');
  }
}

function validateSegments(segmentCount: number, radialCount: number): void {
  if (!Number.isInteger(segmentCount) || segmentCount <= 0) {
    throw new Error('分面贝塞尔管体分段数量必须是正整数。');
  }
  if (!Number.isInteger(radialCount) || radialCount < 3) {
    throw new Error('分面贝塞尔管体径向采样数量至少为三。');
  }
}
