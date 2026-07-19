import { type VertexStreams } from '../../../../../core/mesh/vertex-streams';
import { TAU } from '../../../../../core/math/scalar';
import { CURVE_CRAWLER_EMERGENCE_TOPOLOGY } from '../model/curve-crawler-emergence';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { type CurveCrawlerMeshPlan } from './curve-crawler-mesh-plan';

const NORMAL_EPSILON = 0.000001;

/** 出生几何高频求值复用的蛋壳三角形与碎片四面体缓存。 */
export interface CurveCrawlerEmergenceScratch {
  readonly eggTriangle: Float32Array;
  readonly shardTetrahedron: Float32Array;
}

/** 创建一份由 MeshEvaluator 长期持有的出生几何缓存。 */
export function createCurveCrawlerEmergenceScratch(): CurveCrawlerEmergenceScratch {
  return {
    eggTriangle: new Float32Array(9),
    shardTetrahedron: new Float32Array(12),
  };
}

/** 将单只蜘蛛的地裂、蛋壳和爆裂碎片直接求值到固定动态流。 */
export function evaluateCurveCrawlerEmergenceMesh(
  state: CurveCrawlerState,
  plan: CurveCrawlerMeshPlan,
  entityIndex: number,
  entityVertexOffset: number,
  streams: VertexStreams,
  writePositions: boolean,
  writeNormals: boolean,
  scratch: CurveCrawlerEmergenceScratch,
): void {
  evaluateCracks(
    state,
    plan,
    entityIndex,
    entityVertexOffset,
    streams,
    writePositions,
    writeNormals,
  );
  evaluateEggShell(
    state,
    plan,
    entityIndex,
    entityVertexOffset,
    streams,
    writePositions,
    writeNormals,
    scratch.eggTriangle,
  );
  evaluateEggShards(
    state,
    plan,
    entityIndex,
    entityVertexOffset,
    streams,
    writePositions,
    writeNormals,
    scratch.shardTetrahedron,
  );
}

/** 求值从实体脚下逐段向外生长的七向不规则地裂。 */
function evaluateCracks(
  state: CurveCrawlerState,
  plan: CurveCrawlerMeshPlan,
  entityIndex: number,
  entityVertexOffset: number,
  streams: VertexStreams,
  writePositions: boolean,
  writeNormals: boolean,
): void {
  const topology = CURVE_CRAWLER_EMERGENCE_TOPOLOGY;
  const { identity, transform, morphology, animation } = state.data;
  const seed = identity.appearanceSeed[entityIndex] ?? 1;
  const originX = transform.x[entityIndex] ?? 0;
  const originY = transform.y[entityIndex] ?? 0;
  const spread = clamp01(animation.crackSpread[entityIndex] ?? 0);
  const visibility = clamp01(animation.crackVisibility[entityIndex] ?? 0);
  const maximumRadius = ((morphology.bodyLength[entityIndex] ?? 0) * 0.58
    + (morphology.legLength[entityIndex] ?? 0) * 0.48) * spread;
  const baseWidth = (morphology.bodyWidth[entityIndex] ?? 0) * 0.075 * visibility;
  const firstVertex = entityVertexOffset
    + plan.emergence.vertexOffset
    + plan.emergence.crackVertexOffset;

  let localVertex = 0;
  for (let ray = 0; ray < topology.crackRayCount; ray++) {
    const baseAngle = ray / topology.crackRayCount * TAU
      + hashSigned(seed, ray * 17 + 3) * 0.24;
    for (let segment = 0; segment < topology.crackSegmentCount; segment++) {
      const segmentAmount = clamp01(spread * topology.crackSegmentCount - segment);
      const startRadius = maximumRadius * segment / topology.crackSegmentCount;
      const endRadius = maximumRadius * (segment + segmentAmount)
        / topology.crackSegmentCount;
      const startAngle = baseAngle + hashSigned(seed, ray * 31 + segment * 7 + 11) * 0.13;
      const endAngle = baseAngle + hashSigned(seed, ray * 37 + segment * 13 + 19) * 0.2;
      const startX = originX + Math.cos(startAngle) * startRadius;
      const startY = originY + Math.sin(startAngle) * startRadius;
      const endX = originX + Math.cos(endAngle) * endRadius;
      const endY = originY + Math.sin(endAngle) * endRadius;
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const inverseLength = 1 / Math.max(Math.hypot(deltaX, deltaY), NORMAL_EPSILON);
      const perpendicularX = -deltaY * inverseLength;
      const perpendicularY = deltaX * inverseLength;
      const width = baseWidth * (1 - segment * 0.18) * segmentAmount;
      const startHalfWidth = width * (0.72 + hashUnit(seed, ray * 41 + segment * 5) * 0.28);
      const endHalfWidth = width * (0.38 + hashUnit(seed, ray * 43 + segment * 11) * 0.24);
      const startLeftX = startX - perpendicularX * startHalfWidth;
      const startLeftY = startY - perpendicularY * startHalfWidth;
      const startRightX = startX + perpendicularX * startHalfWidth;
      const startRightY = startY + perpendicularY * startHalfWidth;
      const endLeftX = endX - perpendicularX * endHalfWidth;
      const endLeftY = endY - perpendicularY * endHalfWidth;
      const endRightX = endX + perpendicularX * endHalfWidth;
      const endRightY = endY + perpendicularY * endHalfWidth;
      const vertexOffset = firstVertex + localVertex;
      writeFlatTriangle(
        streams,
        vertexOffset,
        startLeftX, startLeftY, 0.028,
        endLeftX, endLeftY, 0.028,
        endRightX, endRightY, 0.028,
        writePositions,
        writeNormals,
      );
      writeFlatTriangle(
        streams,
        vertexOffset + 3,
        startLeftX, startLeftY, 0.028,
        endRightX, endRightY, 0.028,
        startRightX, startRightY, 0.028,
        writePositions,
        writeNormals,
      );
      localVertex += 6;
    }
  }
}

/** 求值从零长到完整体积、随后发生不规则突起并爆开的独立分面蛋壳。 */
function evaluateEggShell(
  state: CurveCrawlerState,
  plan: CurveCrawlerMeshPlan,
  entityIndex: number,
  entityVertexOffset: number,
  streams: VertexStreams,
  writePositions: boolean,
  writeNormals: boolean,
  triangle: Float32Array,
): void {
  const { identity, transform, morphology, animation } = state.data;
  const emergence = plan.emergence;
  const seed = identity.appearanceSeed[entityIndex] ?? 1;
  const originX = transform.x[entityIndex] ?? 0;
  const originY = transform.y[entityIndex] ?? 0;
  const eggScale = clamp01(animation.eggScale[entityIndex] ?? 0);
  const burst = clamp01(animation.eggBurst[entityIndex] ?? 0);
  const shellScale = eggScale * (1 - burst);
  const bulge = clamp01(animation.eggBulge[entityIndex] ?? 0);
  const radiusX = (morphology.bodyLength[entityIndex] ?? 0) * 0.43 * shellScale;
  const radiusY = (morphology.bodyWidth[entityIndex] ?? 0) * 0.56 * shellScale;
  const radiusZ = (morphology.bodyWidth[entityIndex] ?? 0) * 0.68 * shellScale;
  const centerZ = radiusZ + 0.03;
  const firstVertex = entityVertexOffset + emergence.vertexOffset + emergence.eggVertexOffset;

  for (let triangleVertex = 0; triangleVertex < emergence.eggVertexCount;
    triangleVertex += 3) {
    for (let corner = 0; corner < 3; corner++) {
      const vertex = triangleVertex + corner;
      const directionOffset = vertex * 3;
      const targetOffset = corner * 3;
      const sourceId = emergence.eggSourceVertexIds[vertex] ?? vertex;
      const irregularity = 1 + hashSigned(seed, sourceId * 11 + 5) * 0.075;
      const protrusion = Math.max(0, hashSigned(seed, sourceId * 17 + 29))
        * bulge * 0.38;
      const radiusScale = irregularity + protrusion;
      triangle[targetOffset] = originX
        + (emergence.eggUnitDirections[directionOffset] ?? 0) * radiusX * radiusScale;
      triangle[targetOffset + 1] = originY
        + (emergence.eggUnitDirections[directionOffset + 1] ?? 0) * radiusY * radiusScale;
      triangle[targetOffset + 2] = centerZ
        + (emergence.eggUnitDirections[directionOffset + 2] ?? 0) * radiusZ * radiusScale;
    }
    writeFlatTriangle(
      streams,
      firstVertex + triangleVertex,
      triangle[0] ?? originX,
      triangle[1] ?? originY,
      triangle[2] ?? 0.03,
      triangle[3] ?? originX,
      triangle[4] ?? originY,
      triangle[5] ?? 0.03,
      triangle[6] ?? originX,
      triangle[7] ?? originY,
      triangle[8] ?? 0.03,
      writePositions,
      writeNormals,
    );
  }
}

/** 求值蛋壳瞬间向外飞散的九块不等尺寸四面体碎片。 */
function evaluateEggShards(
  state: CurveCrawlerState,
  plan: CurveCrawlerMeshPlan,
  entityIndex: number,
  entityVertexOffset: number,
  streams: VertexStreams,
  writePositions: boolean,
  writeNormals: boolean,
  tetrahedron: Float32Array,
): void {
  const topology = CURVE_CRAWLER_EMERGENCE_TOPOLOGY;
  const { identity, transform, morphology, animation } = state.data;
  const seed = identity.appearanceSeed[entityIndex] ?? 1;
  const originX = transform.x[entityIndex] ?? 0;
  const originY = transform.y[entityIndex] ?? 0;
  const bodyWidth = morphology.bodyWidth[entityIndex] ?? 0;
  const burst = clamp01(animation.eggBurst[entityIndex] ?? 0);
  const visibility = Math.sin(burst * Math.PI);
  const travel = burst * (2 - burst);

  for (let shard = 0; shard < topology.eggShardCount; shard++) {
    const angle = shard / topology.eggShardCount * TAU
      + hashSigned(seed, shard * 23 + 41) * 0.28;
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    const perpendicularX = -directionY;
    const perpendicularY = directionX;
    const shellRadius = bodyWidth * (0.42 + hashUnit(seed, shard * 31 + 7) * 0.18);
    const travelDistance = bodyWidth * (0.82 + hashUnit(seed, shard * 37 + 13) * 0.72)
      * travel;
    const centerX = originX + directionX * (shellRadius + travelDistance);
    const centerY = originY + directionY * (shellRadius + travelDistance);
    const centerZ = bodyWidth * (0.54 + hashUnit(seed, shard * 41 + 17) * 0.32)
      + Math.sin(burst * Math.PI) * bodyWidth
      * (0.62 + hashUnit(seed, shard * 43 + 19) * 0.5);
    const size = bodyWidth * (0.12 + hashUnit(seed, shard * 47 + 23) * 0.1)
      * visibility;

    writeTetrahedronPoints(
      tetrahedron,
      centerX,
      centerY,
      centerZ,
      directionX,
      directionY,
      perpendicularX,
      perpendicularY,
      size,
    );
    const firstVertex = entityVertexOffset
      + plan.emergence.vertexOffset
      + (plan.emergence.shardVertexOffsets[shard] ?? 0);
    writeTetrahedron(
      streams,
      firstVertex,
      tetrahedron,
      centerX,
      centerY,
      centerZ,
      writePositions,
      writeNormals,
    );
  }
}

/** 将一个方向性四面体的四个角写入复用缓存。 */
function writeTetrahedronPoints(
  target: Float32Array,
  centerX: number,
  centerY: number,
  centerZ: number,
  directionX: number,
  directionY: number,
  perpendicularX: number,
  perpendicularY: number,
  size: number,
): void {
  target[0] = centerX + directionX * size * 1.35;
  target[1] = centerY + directionY * size * 1.35;
  target[2] = centerZ + size * 0.28;
  target[3] = centerX - directionX * size * 0.58 + perpendicularX * size * 0.72;
  target[4] = centerY - directionY * size * 0.58 + perpendicularY * size * 0.72;
  target[5] = centerZ - size * 0.42;
  target[6] = centerX - directionX * size * 0.5 - perpendicularX * size * 0.68;
  target[7] = centerY - directionY * size * 0.5 - perpendicularY * size * 0.68;
  target[8] = centerZ - size * 0.34;
  target[9] = centerX - directionX * size * 0.12;
  target[10] = centerY - directionY * size * 0.12;
  target[11] = centerZ + size;
}

/** 将四面体四个面展开为具有独立法线的十二个顶点。 */
function writeTetrahedron(
  streams: VertexStreams,
  vertexOffset: number,
  points: Float32Array,
  centerX: number,
  centerY: number,
  centerZ: number,
  writePositions: boolean,
  writeNormals: boolean,
): void {
  writeOrientedFace(streams, vertexOffset, points, 0, 2, 1,
    centerX, centerY, centerZ, writePositions, writeNormals);
  writeOrientedFace(streams, vertexOffset + 3, points, 0, 1, 3,
    centerX, centerY, centerZ, writePositions, writeNormals);
  writeOrientedFace(streams, vertexOffset + 6, points, 0, 3, 2,
    centerX, centerY, centerZ, writePositions, writeNormals);
  writeOrientedFace(streams, vertexOffset + 9, points, 1, 2, 3,
    centerX, centerY, centerZ, writePositions, writeNormals);
}

/** 根据四面体中心自动修正一个面的朝外绕序。 */
function writeOrientedFace(
  streams: VertexStreams,
  vertexOffset: number,
  points: Float32Array,
  a: number,
  b: number,
  c: number,
  centerX: number,
  centerY: number,
  centerZ: number,
  writePositions: boolean,
  writeNormals: boolean,
): void {
  const aOffset = a * 3;
  let bOffset = b * 3;
  let cOffset = c * 3;
  const abX = (points[bOffset] ?? 0) - (points[aOffset] ?? 0);
  const abY = (points[bOffset + 1] ?? 0) - (points[aOffset + 1] ?? 0);
  const abZ = (points[bOffset + 2] ?? 0) - (points[aOffset + 2] ?? 0);
  const acX = (points[cOffset] ?? 0) - (points[aOffset] ?? 0);
  const acY = (points[cOffset + 1] ?? 0) - (points[aOffset + 1] ?? 0);
  const acZ = (points[cOffset + 2] ?? 0) - (points[aOffset + 2] ?? 0);
  const normalX = abY * acZ - abZ * acY;
  const normalY = abZ * acX - abX * acZ;
  const normalZ = abX * acY - abY * acX;
  const faceX = ((points[aOffset] ?? 0) + (points[bOffset] ?? 0) + (points[cOffset] ?? 0))
    / 3 - centerX;
  const faceY = ((points[aOffset + 1] ?? 0) + (points[bOffset + 1] ?? 0)
    + (points[cOffset + 1] ?? 0)) / 3 - centerY;
  const faceZ = ((points[aOffset + 2] ?? 0) + (points[bOffset + 2] ?? 0)
    + (points[cOffset + 2] ?? 0)) / 3 - centerZ;
  if (normalX * faceX + normalY * faceY + normalZ * faceZ < 0) {
    const swap = bOffset;
    bOffset = cOffset;
    cOffset = swap;
  }
  writeFlatTriangle(
    streams,
    vertexOffset,
    points[aOffset] ?? centerX,
    points[aOffset + 1] ?? centerY,
    points[aOffset + 2] ?? centerZ,
    points[bOffset] ?? centerX,
    points[bOffset + 1] ?? centerY,
    points[bOffset + 2] ?? centerZ,
    points[cOffset] ?? centerX,
    points[cOffset + 1] ?? centerY,
    points[cOffset + 2] ?? centerZ,
    writePositions,
    writeNormals,
  );
}

/** 写入一个独立三角形的位置和统一硬分面法线。 */
function writeFlatTriangle(
  streams: VertexStreams,
  vertexOffset: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  writePositions: boolean,
  writeNormals: boolean,
): void {
  const abX = bx - ax;
  const abY = by - ay;
  const abZ = bz - az;
  const acX = cx - ax;
  const acY = cy - ay;
  const acZ = cz - az;
  let normalX = abY * acZ - abZ * acY;
  let normalY = abZ * acX - abX * acZ;
  let normalZ = abX * acY - abY * acX;
  const normalLength = Math.hypot(normalX, normalY, normalZ);
  if (normalLength <= NORMAL_EPSILON) {
    normalX = 0;
    normalY = 0;
    normalZ = 1;
  } else {
    const inverseLength = 1 / normalLength;
    normalX *= inverseLength;
    normalY *= inverseLength;
    normalZ *= inverseLength;
  }
  const streamOffset = vertexOffset * 3;
  if (writePositions) {
    streams.positions[streamOffset] = ax;
    streams.positions[streamOffset + 1] = ay;
    streams.positions[streamOffset + 2] = az;
    streams.positions[streamOffset + 3] = bx;
    streams.positions[streamOffset + 4] = by;
    streams.positions[streamOffset + 5] = bz;
    streams.positions[streamOffset + 6] = cx;
    streams.positions[streamOffset + 7] = cy;
    streams.positions[streamOffset + 8] = cz;
  }
  if (writeNormals) {
    for (let corner = 0; corner < 3; corner++) {
      const offset = streamOffset + corner * 3;
      streams.normals[offset] = normalX;
      streams.normals[offset + 1] = normalY;
      streams.normals[offset + 2] = normalZ;
    }
  }
}

/** 从稳定外观种子与通道生成零到一的无状态随机值。 */
function hashUnit(seed: number, channel: number): number {
  let value = (seed ^ Math.imul(channel + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

/** 从稳定外观种子与通道生成负一到一的无状态随机值。 */
function hashSigned(seed: number, channel: number): number {
  return hashUnit(seed, channel) * 2 - 1;
}

/** 将数值约束到零到一之间。 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(value, 1));
}
