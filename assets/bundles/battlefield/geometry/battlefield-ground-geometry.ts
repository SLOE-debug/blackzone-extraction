import { type FixedTopologyMetrics } from '../../../core/geometry/fixed-topology';
import {
  emitSampledFlatGrid,
  sampleFlatGrid,
} from '../../../core/geometry/grid/flat-grid-emitter';
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

  /** 按世界格点和交替对角线写入确定性地面补丁。 */
  public write(
    writer: TriangleMeshWriter,
    centerChunkX = 0,
    centerChunkZ = 0,
  ): void {
    writeBattlefieldGroundPatchFrame(this.frame, centerChunkX, centerChunkZ);
    sampleFlatGrid(
      BATTLEFIELD_GROUND_GRID_PLAN,
      battlefieldGroundGridSampler,
      this.frame,
      this.workspace,
    );
    emitSampledFlatGrid(
      BATTLEFIELD_GROUND_GRID_PLAN,
      this.workspace,
      writer,
      undefined,
    );
  }
}

export const battlefieldGroundGeometry = new BattlefieldGroundGeometry();
