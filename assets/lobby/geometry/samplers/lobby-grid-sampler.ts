import {
  type GridPointSampler,
} from '../../../core/geometry/grid/flat-grid-emitter';
import { type FlatGridPositionArray } from '../../../core/geometry/grid/flat-grid-workspace';
import { type SurfaceFrame } from '../../../core/geometry/grid/surface-frame';
import {
  type LobbySurfaceDeformationContext,
  sampleLobbySurface,
} from '../deformers/lobby-surface-deformer';
import {
  type LobbyGridSample,
  type LobbyLocalSurfacePoint,
} from './lobby-grid-sample';

/** 大厅局部曲面采样器所需的尺寸、坐标基和领域形变参数。 */
export interface LobbyGridSamplerContext {
  readonly columns: number;
  readonly rows: number;
  readonly width: number;
  readonly height: number;
  readonly frame: Readonly<SurfaceFrame>;
  readonly deformation: Readonly<LobbySurfaceDeformationContext>;
}

/**
 * 把大厅洞穴领域采样映射为 Core Flat Grid 的连续世界位置。
 *
 * 可变局部点和采样描述只创建一次，写入过程中不分配临时对象。
 */
class LobbyGridSampler implements GridPointSampler<LobbyGridSamplerContext> {
  private readonly local: LobbyLocalSurfacePoint = { u: 0, v: 0, n: 0 };
  private readonly sampleState: MutableLobbyGridSample = {
    column: 0,
    row: 0,
    columns: 0,
    rows: 0,
    u01: 0,
    v01: 0,
    edge: false,
  };

  public sample(
    context: Readonly<LobbyGridSamplerContext>,
    column: number,
    row: number,
    output: FlatGridPositionArray,
    outputOffset: number,
  ): void {
    const u01 = column / context.columns;
    const v01 = row / context.rows;
    this.sampleState.column = column;
    this.sampleState.row = row;
    this.sampleState.columns = context.columns;
    this.sampleState.rows = context.rows;
    this.sampleState.u01 = u01;
    this.sampleState.v01 = v01;
    this.sampleState.edge = column === 0
      || column === context.columns
      || row === 0
      || row === context.rows;
    this.local.u = context.width * u01;
    this.local.v = context.height * v01;
    this.local.n = 0;
    sampleLobbySurface(this.local, this.sampleState, context.deformation);
    writeSurfacePosition(output, outputOffset, this.local, context.frame);
  }
}

interface MutableLobbyGridSample extends LobbyGridSample {
  column: number;
  row: number;
  columns: number;
  rows: number;
  u01: number;
  v01: number;
  edge: boolean;
}

/** 把局部 U/V/N 坐标映射为世界三维位置。 */
function writeSurfacePosition(
  output: FlatGridPositionArray,
  outputOffset: number,
  local: Readonly<LobbyLocalSurfacePoint>,
  frame: Readonly<SurfaceFrame>,
): void {
  if (!Number.isFinite(local.u) || !Number.isFinite(local.v) || !Number.isFinite(local.n)) {
    throw new Error('大厅 Grid Deformer 必须输出有限局部坐标。');
  }
  output[outputOffset] = frame.originX
    + frame.ux * local.u + frame.vx * local.v + frame.nx * local.n;
  output[outputOffset + 1] = frame.originY
    + frame.uy * local.u + frame.vy * local.v + frame.ny * local.n;
  output[outputOffset + 2] = frame.originZ
    + frame.uz * local.u + frame.vz * local.v + frame.nz * local.n;
}

/** 全部大厅壳体共用的无状态外观采样器；可变 scratch 仅服务同步写入。 */
export const lobbyGridSampler: GridPointSampler<LobbyGridSamplerContext> =
  new LobbyGridSampler();
