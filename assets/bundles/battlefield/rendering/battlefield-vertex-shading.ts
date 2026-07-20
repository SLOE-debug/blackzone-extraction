import {
  type BattlefieldGroundSurfaceSample,
  sampleBattlefieldGroundSurface,
} from '../geometry/battlefield-ground-sampling';

/** 地面着色只要求 CPU 位置、法线和颜色流，不要求对应 GPU 顶点布局。 */
export interface BattlefieldGroundShadingGeometry {
  readonly vertexCount: number;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
}

const BYTE_COLOR_SCALE = 1 / 255;
const BASE_RED = 48 * BYTE_COLOR_SCALE;
const BASE_GREEN = 61 * BYTE_COLOR_SCALE;
const BASE_BLUE = 51 * BYTE_COLOR_SCALE;
const SOIL_RED = 58 * BYTE_COLOR_SCALE;
const SOIL_GREEN = 52 * BYTE_COLOR_SCALE;
const SOIL_BLUE = 43 * BYTE_COLOR_SCALE;
const MOSS_RED = 39 * BYTE_COLOR_SCALE;
const MOSS_GREEN = 68 * BYTE_COLOR_SCALE;
const MOSS_BLUE = 50 * BYTE_COLOR_SCALE;
const surfaceSample: BattlefieldGroundSurfaceSample = {
  macroVariation: 0,
  soilCoverage: 0,
  mossCoverage: 0,
  facetVariation: 0,
};

/** 为每个独立三角面写入由世界坐标决定的泥土、苔藓和细微分面色差。 */
export function shadeBattlefieldGround(
  geometry: BattlefieldGroundShadingGeometry,
  centerWorldX: number,
  centerWorldZ: number,
): void {
  shadeBattlefieldGroundRange(
    geometry,
    0,
    geometry.vertexCount,
    centerWorldX,
    centerWorldZ,
  );
}

/** 为分帧地面求值刚刚覆盖的连续三角形顶点区段写入颜色。 */
export function shadeBattlefieldGroundRange(
  geometry: BattlefieldGroundShadingGeometry,
  firstVertex: number,
  vertexCount: number,
  centerWorldX: number,
  centerWorldZ: number,
): void {
  if (!Number.isInteger(firstVertex)
    || firstVertex < 0
    || firstVertex % 3 !== 0
    || !Number.isInteger(vertexCount)
    || vertexCount < 0
    || vertexCount % 3 !== 0
    || firstVertex + vertexCount > geometry.vertexCount) {
    throw new Error('战场地面着色范围必须完整覆盖连续三角形。');
  }
  const endVertex = firstVertex + vertexCount;
  for (let triangleVertex = firstVertex; triangleVertex < endVertex; triangleVertex += 3) {
    const firstPositionOffset = triangleVertex * 3;
    const secondPositionOffset = firstPositionOffset + 3;
    const thirdPositionOffset = firstPositionOffset + 6;
    const worldX = centerWorldX + (
      (geometry.positions[firstPositionOffset] ?? 0)
      + (geometry.positions[secondPositionOffset] ?? 0)
      + (geometry.positions[thirdPositionOffset] ?? 0)
    ) / 3;
    const worldZ = centerWorldZ + (
      (geometry.positions[firstPositionOffset + 2] ?? 0)
      + (geometry.positions[secondPositionOffset + 2] ?? 0)
      + (geometry.positions[thirdPositionOffset + 2] ?? 0)
    ) / 3;
    const normalY = geometry.normals[firstPositionOffset + 1] ?? 1;
    sampleBattlefieldGroundSurface(worldX, worldZ, surfaceSample);

    const soil = surfaceSample.soilCoverage;
    const moss = surfaceSample.mossCoverage;
    const baseRed = lerp(lerp(BASE_RED, SOIL_RED, soil), MOSS_RED, moss);
    const baseGreen = lerp(lerp(BASE_GREEN, SOIL_GREEN, soil), MOSS_GREEN, moss);
    const baseBlue = lerp(lerp(BASE_BLUE, SOIL_BLUE, soil), MOSS_BLUE, moss);
    const shade = 0.92
      + surfaceSample.macroVariation * 0.08
      + surfaceSample.facetVariation * 0.035
      + (Math.max(0.9, normalY) - 0.9) * 0.32;

    for (let localVertex = 0; localVertex < 3; localVertex++) {
      const colorOffset = (triangleVertex + localVertex) * 4;
      geometry.colors[colorOffset] = Math.min(1, baseRed * shade);
      geometry.colors[colorOffset + 1] = Math.min(1, baseGreen * shade);
      geometry.colors[colorOffset + 2] = Math.min(1, baseBlue * shade);
      geometry.colors[colorOffset + 3] = 1;
    }
  }
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}
