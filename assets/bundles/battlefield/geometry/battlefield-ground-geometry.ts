import { type FixedTopologyMetrics } from '../../../core/geometry/fixed-topology';
import { type TriangleMeshWriter } from '../../../core/geometry/triangle-mesh-writer';
import { BATTLEFIELD_LAYOUT } from '../model/battlefield-layout';
import {
  type BattlefieldGroundPatchFrame,
  type BattlefieldGroundPoint,
  createBattlefieldGroundPatchFrame,
  sampleBattlefieldGroundPoint,
} from './battlefield-ground-sampling';

const VERTEX_COLUMNS = BATTLEFIELD_LAYOUT.groundColumns + 1;
const VERTEX_ROWS = BATTLEFIELD_LAYOUT.groundRows + 1;
const TRIANGLE_COUNT = BATTLEFIELD_LAYOUT.groundColumns * BATTLEFIELD_LAYOUT.groundRows * 2;
const EPSILON = 0.000001;

/** 战场地面固定拓扑，每个三角形独占顶点以保留硬分面。 */
export const BATTLEFIELD_GROUND_TOPOLOGY: FixedTopologyMetrics = Object.freeze({
  verticesPerEntity: TRIANGLE_COUNT * 3,
  indicesPerEntity: TRIANGLE_COUNT * 3,
});

/** 生成随 Chunk 更新、在世界坐标中连续的不规则分面战场地面。 */
export class BattlefieldGroundGeometry {
  public readonly metrics = BATTLEFIELD_GROUND_TOPOLOGY;
  private readonly positions = new Float32Array(VERTEX_COLUMNS * VERTEX_ROWS * 3);
  private readonly sampledPoint: BattlefieldGroundPoint = { x: 0, y: 0, z: 0 };
  private readonly p00: BattlefieldGroundPoint = { x: 0, y: 0, z: 0 };
  private readonly p10: BattlefieldGroundPoint = { x: 0, y: 0, z: 0 };
  private readonly p11: BattlefieldGroundPoint = { x: 0, y: 0, z: 0 };
  private readonly p01: BattlefieldGroundPoint = { x: 0, y: 0, z: 0 };

  /** 按世界格点和交替对角线写入确定性地面补丁。 */
  public write(
    writer: TriangleMeshWriter,
    centerChunkX = 0,
    centerChunkZ = 0,
  ): void {
    const frame = createBattlefieldGroundPatchFrame(centerChunkX, centerChunkZ);
    this.sampleGroundPositions(frame);

    for (let row = 0; row < BATTLEFIELD_LAYOUT.groundRows; row++) {
      for (let column = 0; column < BATTLEFIELD_LAYOUT.groundColumns; column++) {
        const p00Index = row * VERTEX_COLUMNS + column;
        readGroundPoint(this.positions, p00Index, this.p00);
        readGroundPoint(this.positions, p00Index + 1, this.p10);
        readGroundPoint(this.positions, p00Index + VERTEX_COLUMNS + 1, this.p11);
        readGroundPoint(this.positions, p00Index + VERTEX_COLUMNS, this.p01);
        if (((column + row) & 1) === 0) {
          appendGroundTriangle(writer, this.p00, this.p01, this.p11);
          appendGroundTriangle(writer, this.p00, this.p11, this.p10);
        } else {
          appendGroundTriangle(writer, this.p00, this.p01, this.p10);
          appendGroundTriangle(writer, this.p10, this.p01, this.p11);
        }
      }
    }
  }

  /** 先缓存共享格点，避免每个三角形重复执行世界噪声采样。 */
  private sampleGroundPositions(frame: Readonly<BattlefieldGroundPatchFrame>): void {
    for (let row = 0; row < VERTEX_ROWS; row++) {
      const globalRow = frame.firstGlobalRow + row;
      for (let column = 0; column < VERTEX_COLUMNS; column++) {
        const globalColumn = frame.firstGlobalColumn + column;
        sampleBattlefieldGroundPoint(globalColumn, globalRow, frame, this.sampledPoint);
        const offset = (row * VERTEX_COLUMNS + column) * 3;
        this.positions[offset] = this.sampledPoint.x;
        this.positions[offset + 1] = this.sampledPoint.y;
        this.positions[offset + 2] = this.sampledPoint.z;
      }
    }
  }
}

function readGroundPoint(
  positions: Float32Array,
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
