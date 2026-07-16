import { type FixedTopologyMetrics } from '../../../core/geometry/fixed-topology';
import { type TriangleMeshWriter } from '../../../core/geometry/triangle-mesh-writer';
import {
  appendLobbyGridCell,
  type LobbyPoint3,
} from '../lobby-triangle-geometry';
import { type SurfaceFrame } from './surface-frame';

/** Grid Patch 单元格使用的对角线策略。 */
export enum GridPatchDiagonal {
  /** 所有单元格使用 p00 到 p11 的对角线。 */
  Forward = 'forward',
  /** 所有单元格使用 p10 到 p01 的对角线。 */
  Backward = 'backward',
  /** 按行列奇偶交替使用两种对角线。 */
  Alternating = 'alternating',
}

/** 采样函数原地修改的局部曲面坐标。 */
export interface LocalSurfacePoint {
  u: number;
  v: number;
  n: number;
}

/** 当前网格采样点的稳定索引与归一化参数。 */
export interface GridPatchSample {
  readonly column: number;
  readonly row: number;
  readonly columns: number;
  readonly rows: number;
  readonly u01: number;
  readonly v01: number;
  readonly edge: boolean;
}

/**
 * 描述一个严格 Flat Shading 的参数化 Grid Patch。
 *
 * Patch 会先缓存共享采样点，再把每个三角形展开为三个独立顶点，因此 Metrics 与
 * Smooth Grid 不同。sampleLocal 接收已经按 width/height 初始化的 u、v，可继续施加
 * 切向扰动和法向位移。
 */
export interface FlatGridPatchSpec<TContext> {
  readonly columns: number;
  readonly rows: number;
  readonly width: number;
  readonly height: number;
  readonly frame: Readonly<SurfaceFrame>;
  readonly sampleLocal: (
    out: LocalSurfacePoint,
    sample: Readonly<GridPatchSample>,
    context: Readonly<TContext>,
  ) => void;
  readonly diagonal: GridPatchDiagonal;
  readonly alternatingOffset: 0 | 1;
  readonly flipWinding: boolean;
}

interface MutableGridPatchSample {
  column: number;
  row: number;
  columns: number;
  rows: number;
  u01: number;
  v01: number;
  edge: boolean;
}

interface MutablePoint3 {
  x: number;
  y: number;
  z: number;
}

/**
 * 计算 Flat Grid Patch 的固定拓扑容量。
 *
 * @param columns 水平方向单元格数量。
 * @param rows 垂直方向单元格数量。
 * @returns 每个三角形独占三个顶点的固定拓扑计数。
 */
export function getFlatGridPatchMetrics(columns: number, rows: number): FixedTopologyMetrics {
  validateGridSize(columns, rows);
  const triangleCount = columns * rows * 2;
  return Object.freeze({
    verticesPerEntity: triangleCount * 3,
    indicesPerEntity: triangleCount * 3,
  });
}

/**
 * 按局部 U/V/N 坐标基采样并写入严格分面法线的 Grid Patch。
 *
 * @param writer 接收展开后 Position、Normal 与 Index 的三角形写入器。
 * @param spec 网格尺寸、坐标基、采样函数和绕序策略。
 * @param context Feature 专属且只读的形变参数。
 */
export function appendFlatGridPatch<TContext>(
  writer: TriangleMeshWriter,
  spec: Readonly<FlatGridPatchSpec<TContext>>,
  context: Readonly<TContext>,
): void {
  validateSpec(spec);
  const vertexColumns = spec.columns + 1;
  const vertexRows = spec.rows + 1;
  // 使用双精度缓存，确保分面法线与原先直接用 JavaScript number 计算的结果一致。
  const sampledPositions = new Float64Array(vertexColumns * vertexRows * 3);
  const local: LocalSurfacePoint = { u: 0, v: 0, n: 0 };
  const sample: MutableGridPatchSample = {
    column: 0,
    row: 0,
    columns: spec.columns,
    rows: spec.rows,
    u01: 0,
    v01: 0,
    edge: false,
  };

  for (let row = 0; row < vertexRows; row++) {
    sample.row = row;
    sample.v01 = row / spec.rows;
    for (let column = 0; column < vertexColumns; column++) {
      sample.column = column;
      sample.u01 = column / spec.columns;
      sample.edge = column === 0
        || column === spec.columns
        || row === 0
        || row === spec.rows;
      local.u = spec.width * sample.u01;
      local.v = spec.height * sample.v01;
      local.n = 0;
      spec.sampleLocal(local, sample, context);
      writeSamplePosition(sampledPositions, row * vertexColumns + column, local, spec.frame);
    }
  }

  const p00: MutablePoint3 = { x: 0, y: 0, z: 0 };
  const p10: MutablePoint3 = { x: 0, y: 0, z: 0 };
  const p11: MutablePoint3 = { x: 0, y: 0, z: 0 };
  const p01: MutablePoint3 = { x: 0, y: 0, z: 0 };
  for (let row = 0; row < spec.rows; row++) {
    for (let column = 0; column < spec.columns; column++) {
      const p00Index = row * vertexColumns + column;
      const p10Index = p00Index + 1;
      const p01Index = p00Index + vertexColumns;
      const p11Index = p01Index + 1;
      readSamplePosition(sampledPositions, p00Index, p00);
      readSamplePosition(sampledPositions, p10Index, p10);
      readSamplePosition(sampledPositions, p11Index, p11);
      readSamplePosition(sampledPositions, p01Index, p01);
      appendLobbyGridCell(
        writer,
        p00,
        p10,
        p11,
        p01,
        usesBackwardDiagonal(spec, column, row),
        spec.flipWinding,
      );
    }
  }
}

/** 把局部曲面点映射到世界坐标缓存。 */
function writeSamplePosition(
  positions: Float64Array,
  pointIndex: number,
  local: Readonly<LocalSurfacePoint>,
  frame: Readonly<SurfaceFrame>,
): void {
  if (![local.u, local.v, local.n].every(Number.isFinite)) {
    throw new Error('Grid Patch 采样函数必须输出有限局部坐标。');
  }
  const offset = pointIndex * 3;
  positions[offset] = frame.originX
    + frame.ux * local.u + frame.vx * local.v + frame.nx * local.n;
  positions[offset + 1] = frame.originY
    + frame.uy * local.u + frame.vy * local.v + frame.ny * local.n;
  positions[offset + 2] = frame.originZ
    + frame.uz * local.u + frame.vz * local.v + frame.nz * local.n;
}

/** 从共享采样缓存读取一个曲面点，供 Flat 三角形展开复用。 */
function readSamplePosition(
  positions: Float64Array,
  pointIndex: number,
  target: MutablePoint3,
): LobbyPoint3 {
  const offset = pointIndex * 3;
  target.x = positions[offset] ?? 0;
  target.y = positions[offset + 1] ?? 0;
  target.z = positions[offset + 2] ?? 0;
  return target;
}

/** 根据固定策略决定当前单元格使用哪一条对角线。 */
function usesBackwardDiagonal<TContext>(
  spec: Readonly<FlatGridPatchSpec<TContext>>,
  column: number,
  row: number,
): boolean {
  switch (spec.diagonal) {
    case GridPatchDiagonal.Forward:
      return false;
    case GridPatchDiagonal.Backward:
      return true;
    case GridPatchDiagonal.Alternating:
      return ((column + row + spec.alternatingOffset) & 1) !== 0;
    default:
      throw new Error(`未知的 Grid Patch 对角线策略：${String(spec.diagonal)}`);
  }
}

/** 校验网格细分数量。 */
function validateGridSize(columns: number, rows: number): void {
  if (!Number.isInteger(columns) || columns <= 0
    || !Number.isInteger(rows) || rows <= 0) {
    throw new Error('Grid Patch 的行列数量必须是正整数。');
  }
}

/** 校验 Patch 的尺寸和交替偏移。 */
function validateSpec<TContext>(spec: Readonly<FlatGridPatchSpec<TContext>>): void {
  validateGridSize(spec.columns, spec.rows);
  if (!Number.isFinite(spec.width) || spec.width <= 0
    || !Number.isFinite(spec.height) || spec.height <= 0) {
    throw new Error('Grid Patch 的宽高必须是有限正数。');
  }
  if (spec.alternatingOffset !== 0 && spec.alternatingOffset !== 1) {
    throw new Error('Grid Patch 的交替对角线偏移只能是零或一。');
  }
}
