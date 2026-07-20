import { type FixedTopologyMetrics } from '../../../core/geometry/fixed-topology';
import {
  emitFixedTopologyFlatTriangleCoordinates,
} from '../../../core/geometry/faceted/faceted-emitter';
import {
  compileFlatGridPlan,
  FlatGridDiagonalKind,
  type FlatGridPlan,
  FlatGridTriangleOrder,
  FlatGridWinding,
  getFlatGridTopologyMetrics,
} from '../../../core/geometry/grid/flat-grid-plan';
import {
  createFlatGridWorkspace,
  type FlatGridWorkspace,
  FlatGridWorkspacePrecision,
} from '../../../core/geometry/grid/flat-grid-workspace';
import { type TriangleMeshWriter } from '../../../core/geometry/triangle-mesh-writer';
import { BATTLEFIELD_LAYOUT } from '../model/battlefield-layout';
import { battlefieldGroundGridSampler } from './battlefield-ground-grid-sampler';
import {
  type MutableBattlefieldGroundPatchFrame,
  writeBattlefieldGroundPatchFrame,
} from './battlefield-ground-sampling';

/** 一次分帧地面写入实际覆盖的连续顶点范围。 */
export interface MutableBattlefieldGroundWriteRange {
  firstVertex: number;
  vertexCount: number;
  centerWorldX: number;
  centerWorldZ: number;
}

/** Ground 需要保留的单元格三角形顺序，与按面着色及黄金输出共同构成稳定契约。 */
const BATTLEFIELD_GROUND_TRIANGLE_ORDER = Object.freeze({
  forward: FlatGridTriangleOrder.SecondaryFirst,
  backward: FlatGridTriangleOrder.PrimaryFirst,
});

/** 战场地面共享格点到独立硬分面的预编译固定计划。 */
export const BATTLEFIELD_GROUND_GRID_PLAN: FlatGridPlan = compileFlatGridPlan({
  columns: BATTLEFIELD_LAYOUT.groundColumns,
  rows: BATTLEFIELD_LAYOUT.groundRows,
  diagonal: Object.freeze({
    kind: FlatGridDiagonalKind.Alternating,
    parityOffset: 0,
  }),
  winding: FlatGridWinding.Reverse,
  triangleOrder: BATTLEFIELD_GROUND_TRIANGLE_ORDER,
});

/** 战场地面固定拓扑，每个三角形独占顶点以保留硬分面。 */
export const BATTLEFIELD_GROUND_TOPOLOGY: FixedTopologyMetrics =
  getFlatGridTopologyMetrics(BATTLEFIELD_GROUND_GRID_PLAN);

/** 生成随 Chunk 更新、在世界坐标中连续的不规则分面战场地面。 */
export class BattlefieldGroundGeometry {
  public readonly metrics = BATTLEFIELD_GROUND_TOPOLOGY;
  private readonly workspace: FlatGridWorkspace = createFlatGridWorkspace(
    BATTLEFIELD_GROUND_GRID_PLAN,
    FlatGridWorkspacePrecision.Float32,
  );
  private readonly frame: MutableBattlefieldGroundPatchFrame = {
    centerWorldX: 0,
    centerWorldZ: 0,
    firstGlobalColumn: 0,
    firstGlobalRow: 0,
  };
  private readonly immediateWriteRange: MutableBattlefieldGroundWriteRange = {
    firstVertex: 0,
    vertexCount: 0,
    centerWorldX: 0,
    centerWorldZ: 0,
  };
  private nextCellRow = 0;
  private writeTopology = false;
  private writeInProgress = false;

  /** 按世界格点和交替对角线写入确定性地面补丁。 */
  public write(
    writer: TriangleMeshWriter,
    centerChunkX = 0,
    centerChunkZ = 0,
  ): void {
    this.beginWrite(writer, centerChunkX, centerChunkZ, true);
    this.writeNextRows(
      writer,
      BATTLEFIELD_GROUND_GRID_PLAN.rows,
      this.immediateWriteRange,
    );
  }

  /** 重启一次从首行开始的固定拓扑地面写入。 */
  public beginWrite(
    writer: TriangleMeshWriter,
    centerChunkX: number,
    centerChunkZ: number,
    writeTopology: boolean,
  ): void {
    writeBattlefieldGroundPatchFrame(this.frame, centerChunkX, centerChunkZ);
    writer.reset(writeTopology);
    this.nextCellRow = 0;
    this.writeTopology = writeTopology;
    this.writeInProgress = true;
  }

  /**
   * 顺序写入不超过指定数量的单元格行，并保持 Writer 游标跨帧连续。
   *
   * @returns 当前地面补丁是否已经全部写完。
   */
  public writeNextRows(
    writer: TriangleMeshWriter,
    maximumRows: number,
    range: MutableBattlefieldGroundWriteRange,
  ): boolean {
    if (!this.writeInProgress) {
      throw new Error('战场地面分帧写入尚未开始。');
    }
    if (!Number.isInteger(maximumRows) || maximumRows <= 0) {
      throw new Error('战场地面单帧写入行数必须是正整数。');
    }
    const plan = BATTLEFIELD_GROUND_GRID_PLAN;
    const firstCellRow = this.nextCellRow;
    const endCellRow = Math.min(plan.rows, firstCellRow + maximumRows);
    this.sampleRows(firstCellRow, endCellRow);
    this.emitRows(writer, firstCellRow, endCellRow);
    this.nextCellRow = endCellRow;

    const verticesPerCellRow = plan.columns * 2 * 3;
    range.firstVertex = firstCellRow * verticesPerCellRow;
    range.vertexCount = (endCellRow - firstCellRow) * verticesPerCellRow;
    range.centerWorldX = this.frame.centerWorldX;
    range.centerWorldZ = this.frame.centerWorldZ;

    const complete = endCellRow >= plan.rows;
    if (complete) {
      if (this.writeTopology) {
        writer.commit();
      } else {
        writer.assertCounts(this.metrics.verticesPerEntity, this.metrics.indicesPerEntity);
      }
      this.writeInProgress = false;
    }
    return complete;
  }

  /** 放弃尚未上传的 CPU 写入进度。 */
  public cancelWrite(): void {
    this.writeInProgress = false;
  }

  /** 为待写单元格行采样其上下边界包含的全部共享格点。 */
  private sampleRows(firstCellRow: number, endCellRow: number): void {
    const plan = BATTLEFIELD_GROUND_GRID_PLAN;
    const sampleColumns = plan.columns + 1;
    for (let row = firstCellRow; row <= endCellRow; row++) {
      for (let column = 0; column <= plan.columns; column++) {
        const outputOffset = (row * sampleColumns + column) * 3;
        battlefieldGroundGridSampler.sample(
          this.frame,
          column,
          row,
          this.workspace.positions,
          outputOffset,
        );
      }
    }
  }

  /** 把已采样格点行按预编译三角顺序展开到连续硬分面顶点。 */
  private emitRows(
    writer: TriangleMeshWriter,
    firstCellRow: number,
    endCellRow: number,
  ): void {
    const plan = BATTLEFIELD_GROUND_GRID_PLAN;
    const positions = this.workspace.positions;
    const samples = plan.triangleSampleIndices;
    const samplesPerCellRow = plan.columns * 2 * 3;
    const firstSample = firstCellRow * samplesPerCellRow;
    const endSample = endCellRow * samplesPerCellRow;
    for (let offset = firstSample; offset < endSample; offset += 3) {
      const aOffset = (samples[offset] ?? 0) * 3;
      const bOffset = (samples[offset + 1] ?? 0) * 3;
      const cOffset = (samples[offset + 2] ?? 0) * 3;
      emitFixedTopologyFlatTriangleCoordinates(
        writer,
        undefined,
        positions[aOffset] ?? 0,
        positions[aOffset + 1] ?? 0,
        positions[aOffset + 2] ?? 0,
        positions[bOffset] ?? 0,
        positions[bOffset + 1] ?? 0,
        positions[bOffset + 2] ?? 0,
        positions[cOffset] ?? 0,
        positions[cOffset + 1] ?? 0,
        positions[cOffset + 2] ?? 0,
      );
    }
  }
}

export const battlefieldGroundGeometry = new BattlefieldGroundGeometry();
