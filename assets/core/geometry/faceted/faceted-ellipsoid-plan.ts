import { type MeshPlan } from '../../mesh/mesh-plan';
import { TAU } from '../../math/scalar';

/** 分面椭球固定拓扑与确定性轮廓参数。 */
export interface FacetedEllipsoidPlan extends MeshPlan {
  readonly longitudeCount: number;
  readonly latitudeCount: number;
  /** 每个独立三角顶点的单位方向。 */
  readonly unitDirections: Float32Array;
  /** 每个独立三角顶点对应的逻辑采样点。 */
  readonly sampleIds: Uint16Array;
  /** 每个独立三角顶点的确定性径向比例。 */
  readonly radiusScales: Float32Array;
}

/** 编译分面椭球所需的完整风格参数。 */
export interface FacetedEllipsoidPlanSpec {
  readonly longitudeCount: number;
  readonly latitudeCount: number;
  readonly radialJitter: number;
  readonly ringTwist: number;
  readonly seed: number;
}

/** 返回去除经纬极点退化面后的分面椭球拓扑规模。 */
export function getFacetedEllipsoidTopologyMetrics(
  longitudeCount: number,
  latitudeCount: number,
): Readonly<{ vertexCount: number; indexCount: number }> {
  validateSegments(longitudeCount, latitudeCount);
  const triangleCount = longitudeCount * (latitudeCount - 1) * 2;
  const sequentialVertexCount = triangleCount * 3;
  return Object.freeze({
    vertexCount: sequentialVertexCount,
    indexCount: sequentialVertexCount,
  });
}

/**
 * 编译使用单一上下极点、错角纬圈和确定性半径扰动的硬分面椭球。
 *
 * 输出索引始终顺序指向独立三角顶点，使运行时能够为每个面写入真实 Face Normal。
 */
export function compileFacetedEllipsoidPlan(
  spec: Readonly<FacetedEllipsoidPlanSpec>,
): FacetedEllipsoidPlan {
  validateSpec(spec);
  const metrics = getFacetedEllipsoidTopologyMetrics(
    spec.longitudeCount,
    spec.latitudeCount,
  );
  if (metrics.vertexCount > 0xffff) {
    throw new Error('分面椭球局部顶点数量超过 Uint16 索引范围。');
  }

  const logicalSampleCount = 2 + (spec.latitudeCount - 1) * spec.longitudeCount;
  const logicalDirections = new Float32Array(logicalSampleCount * 3);
  const logicalRadiusScales = new Float32Array(logicalSampleCount);
  writeLogicalSample(logicalDirections, logicalRadiusScales, 0, 0, 0, -1, spec);
  writeLogicalSample(logicalDirections, logicalRadiusScales, 1, 0, 0, 1, spec);

  for (let latitude = 1; latitude < spec.latitudeCount; latitude++) {
    const latitudeAngle = latitude / spec.latitudeCount * Math.PI - Math.PI * 0.5;
    const latitudeCosine = Math.cos(latitudeAngle);
    const latitudeSine = Math.sin(latitudeAngle);
    const twist = signedHash(spec.seed, latitude * 37 + 11) * spec.ringTwist;
    for (let longitude = 0; longitude < spec.longitudeCount; longitude++) {
      const angle = longitude / spec.longitudeCount * TAU + twist;
      const sampleId = getRingSampleId(spec.longitudeCount, latitude, longitude);
      writeLogicalSample(
        logicalDirections,
        logicalRadiusScales,
        sampleId,
        latitudeCosine * Math.cos(angle),
        latitudeCosine * Math.sin(angle),
        latitudeSine,
        spec,
      );
    }
  }

  const unitDirections = new Float32Array(metrics.vertexCount * 3);
  const sampleIds = new Uint16Array(metrics.vertexCount);
  const radiusScales = new Float32Array(metrics.vertexCount);
  let vertexOffset = 0;
  for (let longitude = 0; longitude < spec.longitudeCount; longitude++) {
    const next = (longitude + 1) % spec.longitudeCount;
    vertexOffset = appendTriangle(
      unitDirections,
      sampleIds,
      radiusScales,
      vertexOffset,
      0,
      getRingSampleId(spec.longitudeCount, 1, next),
      getRingSampleId(spec.longitudeCount, 1, longitude),
      logicalDirections,
      logicalRadiusScales,
    );
  }
  for (let latitude = 1; latitude < spec.latitudeCount - 1; latitude++) {
    for (let longitude = 0; longitude < spec.longitudeCount; longitude++) {
      const next = (longitude + 1) % spec.longitudeCount;
      const current = getRingSampleId(spec.longitudeCount, latitude, longitude);
      const currentNext = getRingSampleId(spec.longitudeCount, latitude, next);
      const upper = getRingSampleId(spec.longitudeCount, latitude + 1, longitude);
      const upperNext = getRingSampleId(spec.longitudeCount, latitude + 1, next);
      vertexOffset = appendTriangle(
        unitDirections,
        sampleIds,
        radiusScales,
        vertexOffset,
        current,
        currentNext,
        upper,
        logicalDirections,
        logicalRadiusScales,
      );
      vertexOffset = appendTriangle(
        unitDirections,
        sampleIds,
        radiusScales,
        vertexOffset,
        currentNext,
        upperNext,
        upper,
        logicalDirections,
        logicalRadiusScales,
      );
    }
  }
  for (let longitude = 0; longitude < spec.longitudeCount; longitude++) {
    const next = (longitude + 1) % spec.longitudeCount;
    vertexOffset = appendTriangle(
      unitDirections,
      sampleIds,
      radiusScales,
      vertexOffset,
      getRingSampleId(spec.longitudeCount, spec.latitudeCount - 1, longitude),
      getRingSampleId(spec.longitudeCount, spec.latitudeCount - 1, next),
      1,
      logicalDirections,
      logicalRadiusScales,
    );
  }
  if (vertexOffset !== metrics.vertexCount) {
    throw new Error('分面椭球编译后的顶点数量与拓扑计划不一致。');
  }

  const indices = new Uint16Array(metrics.indexCount);
  for (let index = 0; index < indices.length; index++) {
    indices[index] = index;
  }
  return Object.freeze({
    longitudeCount: spec.longitudeCount,
    latitudeCount: spec.latitudeCount,
    vertexCount: metrics.vertexCount,
    indexCount: metrics.indexCount,
    indices,
    unitDirections,
    sampleIds,
    radiusScales,
  });
}

function appendTriangle(
  directions: Float32Array,
  sampleIds: Uint16Array,
  radiusScales: Float32Array,
  vertexOffset: number,
  a: number,
  b: number,
  c: number,
  logicalDirections: Float32Array,
  logicalRadiusScales: Float32Array,
): number {
  const triangleSamples = [a, b, c] as const;
  for (let corner = 0; corner < triangleSamples.length; corner++) {
    const sampleId = triangleSamples[corner];
    const sourceOffset = sampleId * 3;
    const targetVertex = vertexOffset + corner;
    const targetOffset = targetVertex * 3;
    directions[targetOffset] = logicalDirections[sourceOffset] ?? 0;
    directions[targetOffset + 1] = logicalDirections[sourceOffset + 1] ?? 0;
    directions[targetOffset + 2] = logicalDirections[sourceOffset + 2] ?? 0;
    sampleIds[targetVertex] = sampleId;
    radiusScales[targetVertex] = logicalRadiusScales[sampleId] ?? 1;
  }
  return vertexOffset + 3;
}

function writeLogicalSample(
  directions: Float32Array,
  radiusScales: Float32Array,
  sampleId: number,
  x: number,
  y: number,
  z: number,
  spec: Readonly<FacetedEllipsoidPlanSpec>,
): void {
  const offset = sampleId * 3;
  directions[offset] = x;
  directions[offset + 1] = y;
  directions[offset + 2] = z;
  radiusScales[sampleId] = 1 + signedHash(spec.seed, sampleId * 53 + 19) * spec.radialJitter;
}

function getRingSampleId(
  longitudeCount: number,
  latitude: number,
  longitude: number,
): number {
  return 2 + (latitude - 1) * longitudeCount + longitude;
}

function signedHash(seed: number, salt: number): number {
  let value = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 0xffffffff * 2 - 1;
}

function validateSpec(spec: Readonly<FacetedEllipsoidPlanSpec>): void {
  validateSegments(spec.longitudeCount, spec.latitudeCount);
  if (!Number.isFinite(spec.radialJitter)
    || spec.radialJitter < 0
    || spec.radialJitter > 0.35
    || !Number.isFinite(spec.ringTwist)
    || spec.ringTwist < 0
    || spec.ringTwist > Math.PI / 3
    || !Number.isInteger(spec.seed)) {
    throw new Error('分面椭球扰动、错角和 seed 配置无效。');
  }
}

function validateSegments(longitudeCount: number, latitudeCount: number): void {
  if (!Number.isInteger(longitudeCount) || longitudeCount < 3) {
    throw new Error('分面椭球经线分段数量至少为三。');
  }
  if (!Number.isInteger(latitudeCount) || latitudeCount < 2) {
    throw new Error('分面椭球纬线分段数量至少为二。');
  }
}
