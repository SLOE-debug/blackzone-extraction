import { type FixedTopologyMetrics } from '../../../core/geometry/fixed-topology';
import { type TriangleMeshWriter } from '../../../core/geometry/triangle-mesh-writer';
import { BATTLEFIELD_LAYOUT } from '../model/battlefield-layout';

interface BattlefieldGroundPoint {
  x: number;
  y: number;
  z: number;
}

const VERTEX_COLUMNS = BATTLEFIELD_LAYOUT.groundColumns + 1;
const VERTEX_ROWS = BATTLEFIELD_LAYOUT.groundRows + 1;
const TRIANGLE_COUNT = BATTLEFIELD_LAYOUT.groundColumns * BATTLEFIELD_LAYOUT.groundRows * 2;
const EPSILON = 0.000001;

/** 战场地面固定拓扑，每个三角形独占顶点以保留硬分面。 */
export const BATTLEFIELD_GROUND_TOPOLOGY: FixedTopologyMetrics = Object.freeze({
  verticesPerEntity: TRIANGLE_COUNT * 3,
  indicesPerEntity: TRIANGLE_COUNT * 3,
});

/** 生成中心可行走、边缘隆起的不规则洞穴战场地面。 */
export class BattlefieldGroundGeometry {
  public readonly metrics = BATTLEFIELD_GROUND_TOPOLOGY;

  /** 按固定网格和交替对角线写入确定性地面拓扑。 */
  public write(writer: TriangleMeshWriter): void {
    const positions = sampleGroundPositions();
    const p00: BattlefieldGroundPoint = { x: 0, y: 0, z: 0 };
    const p10: BattlefieldGroundPoint = { x: 0, y: 0, z: 0 };
    const p11: BattlefieldGroundPoint = { x: 0, y: 0, z: 0 };
    const p01: BattlefieldGroundPoint = { x: 0, y: 0, z: 0 };

    for (let row = 0; row < BATTLEFIELD_LAYOUT.groundRows; row++) {
      for (let column = 0; column < BATTLEFIELD_LAYOUT.groundColumns; column++) {
        const p00Index = row * VERTEX_COLUMNS + column;
        readGroundPoint(positions, p00Index, p00);
        readGroundPoint(positions, p00Index + 1, p10);
        readGroundPoint(positions, p00Index + VERTEX_COLUMNS + 1, p11);
        readGroundPoint(positions, p00Index + VERTEX_COLUMNS, p01);
        if (((column + row) & 1) === 0) {
          appendGroundTriangle(writer, p00, p01, p11);
          appendGroundTriangle(writer, p00, p11, p10);
        } else {
          appendGroundTriangle(writer, p00, p01, p10);
          appendGroundTriangle(writer, p10, p01, p11);
        }
      }
    }
  }
}

function sampleGroundPositions(): Float64Array {
  const positions = new Float64Array(VERTEX_COLUMNS * VERTEX_ROWS * 3);
  const extent = BATTLEFIELD_LAYOUT.groundHalfExtent;
  for (let row = 0; row < VERTEX_ROWS; row++) {
    const z = -extent + row / BATTLEFIELD_LAYOUT.groundRows * extent * 2;
    for (let column = 0; column < VERTEX_COLUMNS; column++) {
      const x = -extent + column / BATTLEFIELD_LAYOUT.groundColumns * extent * 2;
      const offset = (row * VERTEX_COLUMNS + column) * 3;
      positions[offset] = x;
      positions[offset + 1] = sampleGroundHeight(x, z, column, row);
      positions[offset + 2] = z;
    }
  }
  return positions;
}

/** 以中央低起伏和边缘岩脊构成稳定、可复现的洞穴地形。 */
function sampleGroundHeight(x: number, z: number, column: number, row: number): number {
  const distance = Math.hypot(x, z);
  const edgeStart = BATTLEFIELD_LAYOUT.centralSafeRadius;
  const edgeRange = BATTLEFIELD_LAYOUT.groundHalfExtent - edgeStart;
  const edgeFactor = smoothStep(Math.max(0, Math.min(1, (distance - edgeStart) / edgeRange)));
  const centralFacetFactor = smoothStep(Math.min(1, distance / 4));
  const facetNoise = hashGroundSample(column, row) * 2 - 1;
  const crossingRidge = Math.sin(x * 0.31 + z * 0.17) * 0.07;
  const centralFacet = (facetNoise * 0.08 + crossingRidge) * centralFacetFactor;
  const edgeRidge = edgeFactor * (1.6 + facetNoise * 0.72 + Math.sin(z * 0.42) * 0.24);
  return centralFacet + edgeRidge;
}

function hashGroundSample(column: number, row: number): number {
  let value = Math.imul(column + 17, 0x45d9f3b) ^ Math.imul(row + 31, 0x119de1f3);
  value ^= value >>> 16;
  value = Math.imul(value, 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

function smoothStep(value: number): number {
  return value * value * (3 - value * 2);
}

function readGroundPoint(
  positions: Float64Array,
  pointIndex: number,
  target: BattlefieldGroundPoint,
): void {
  const offset = pointIndex * 3;
  target.x = positions[offset] ?? 0;
  target.y = positions[offset + 1] ?? 0;
  target.z = positions[offset + 2] ?? 0;
}

function appendGroundTriangle(
  writer: TriangleMeshWriter,
  a: Readonly<BattlefieldGroundPoint>,
  b: Readonly<BattlefieldGroundPoint>,
  c: Readonly<BattlefieldGroundPoint>,
): void {
  const edgeABX = b.x - a.x;
  const edgeABY = b.y - a.y;
  const edgeABZ = b.z - a.z;
  const edgeACX = c.x - a.x;
  const edgeACY = c.y - a.y;
  const edgeACZ = c.z - a.z;
  const crossX = edgeABY * edgeACZ - edgeABZ * edgeACY;
  const crossY = edgeABZ * edgeACX - edgeABX * edgeACZ;
  const crossZ = edgeABX * edgeACY - edgeABY * edgeACX;
  const inverseLength = 1 / Math.max(Math.hypot(crossX, crossY, crossZ), EPSILON);
  const normalX = crossX * inverseLength;
  const normalY = crossY * inverseLength;
  const normalZ = crossZ * inverseLength;
  const indexA = writer.vertex(a.x, a.y, a.z, normalX, normalY, normalZ);
  const indexB = writer.vertex(b.x, b.y, b.z, normalX, normalY, normalZ);
  const indexC = writer.vertex(c.x, c.y, c.z, normalX, normalY, normalZ);
  writer.triangle(indexA, indexB, indexC);
}

export const battlefieldGroundGeometry = new BattlefieldGroundGeometry();
