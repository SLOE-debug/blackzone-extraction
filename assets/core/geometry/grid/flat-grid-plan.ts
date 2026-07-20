import { type FixedTopologyMetrics } from '../fixed-topology';

/** Flat Grid 单元格使用的对角线类别。 */
export enum FlatGridDiagonalKind {
  FixedForward = 'fixed-forward',
  FixedBackward = 'fixed-backward',
  Alternating = 'alternating',
}

/** Flat Grid 的类型化对角线策略。 */
export type FlatGridDiagonalPolicy =
  | { readonly kind: FlatGridDiagonalKind.FixedForward }
  | { readonly kind: FlatGridDiagonalKind.FixedBackward }
  | {
    readonly kind: FlatGridDiagonalKind.Alternating;
    readonly parityOffset: 0 | 1;
  };

/** 三角形样本索引相对 U/V 参数面的绕序。 */
export enum FlatGridWinding {
  Forward = 'forward',
  Reverse = 'reverse',
}

/** 同一单元格内两组三角形的稳定写入顺序。 */
export enum FlatGridTriangleOrder {
  PrimaryFirst = 'primary-first',
  SecondaryFirst = 'secondary-first',
}

/** 按实际对角线分别声明三角形顺序，避免迁移时改变按面语义。 */
export interface FlatGridTriangleOrderPolicy {
  readonly forward: FlatGridTriangleOrder;
  readonly backward: FlatGridTriangleOrder;
}

/** 编译 Flat Grid 固定拓扑所需的全部机械配置。 */
export interface FlatGridPlanSpec {
  readonly columns: number;
  readonly rows: number;
  readonly diagonal: Readonly<FlatGridDiagonalPolicy>;
  readonly winding: FlatGridWinding;
  readonly triangleOrder: Readonly<FlatGridTriangleOrderPolicy>;
}

/** 共享格点到独立硬分面三角形的固定索引计划。 */
export interface FlatGridPlan {
  readonly columns: number;
  readonly rows: number;
  readonly sampleCount: number;
  readonly triangleCount: number;
  /** 每三个值表示一个独立三角形引用的三个共享采样点。 */
  readonly triangleSampleIndices: Uint32Array;
}

/** 两种对角线都保持基础三角形优先的常用顺序。 */
export const PRIMARY_FIRST_FLAT_GRID_TRIANGLE_ORDER: FlatGridTriangleOrderPolicy = Object.freeze({
  forward: FlatGridTriangleOrder.PrimaryFirst,
  backward: FlatGridTriangleOrder.PrimaryFirst,
});

/** 编译可复用、与 Feature 采样内容无关的 Flat Grid 固定拓扑。 */
export function compileFlatGridPlan(spec: Readonly<FlatGridPlanSpec>): FlatGridPlan {
  validateSpec(spec);
  const sampleColumns = spec.columns + 1;
  const sampleCount = sampleColumns * (spec.rows + 1);
  const triangleCount = spec.columns * spec.rows * 2;
  const triangleSampleIndices = new Uint32Array(triangleCount * 3);
  let outputOffset = 0;

  for (let row = 0; row < spec.rows; row++) {
    for (let column = 0; column < spec.columns; column++) {
      const p00 = row * sampleColumns + column;
      const p10 = p00 + 1;
      const p01 = p00 + sampleColumns;
      const p11 = p01 + 1;
      const backward = usesBackwardDiagonal(spec.diagonal, column, row);
      const order = backward
        ? spec.triangleOrder.backward
        : spec.triangleOrder.forward;
      outputOffset = writeCellTriangles(
        triangleSampleIndices,
        outputOffset,
        p00,
        p10,
        p11,
        p01,
        backward,
        order,
        spec.winding,
      );
    }
  }

  if (outputOffset !== triangleSampleIndices.length) {
    throw new Error('Flat Grid 编译后的三角形索引数量与声明不一致。');
  }
  return Object.freeze({
    columns: spec.columns,
    rows: spec.rows,
    sampleCount,
    triangleCount,
    triangleSampleIndices,
  });
}

/** 把 Flat Grid Plan 转换为每个三角形独占顶点的固定拓扑容量。 */
export function getFlatGridTopologyMetrics(
  plan: Readonly<FlatGridPlan>,
): FixedTopologyMetrics {
  return Object.freeze({
    verticesPerEntity: plan.triangleCount * 3,
    indicesPerEntity: plan.triangleCount * 3,
  });
}

/** 按稳定顺序写入当前单元格的两个三角形样本索引。 */
function writeCellTriangles(
  target: Uint32Array,
  outputOffset: number,
  p00: number,
  p10: number,
  p11: number,
  p01: number,
  backward: boolean,
  order: FlatGridTriangleOrder,
  winding: FlatGridWinding,
): number {
  const primaryA = p00;
  const primaryB = p10;
  const primaryC = backward ? p01 : p11;
  const secondaryA = backward ? p10 : p00;
  const secondaryB = p11;
  const secondaryC = p01;

  if (order === FlatGridTriangleOrder.PrimaryFirst) {
    outputOffset = writeTriangle(
      target, outputOffset, primaryA, primaryB, primaryC, winding,
    );
    return writeTriangle(
      target, outputOffset, secondaryA, secondaryB, secondaryC, winding,
    );
  }
  if (order === FlatGridTriangleOrder.SecondaryFirst) {
    outputOffset = writeTriangle(
      target, outputOffset, secondaryA, secondaryB, secondaryC, winding,
    );
    return writeTriangle(
      target, outputOffset, primaryA, primaryB, primaryC, winding,
    );
  }
  throw new Error(`未知的 Flat Grid 三角形顺序：${String(order)}`);
}

/** 按显式绕序写入单个三角形的三个样本索引。 */
function writeTriangle(
  target: Uint32Array,
  outputOffset: number,
  a: number,
  b: number,
  c: number,
  winding: FlatGridWinding,
): number {
  target[outputOffset] = a;
  if (winding === FlatGridWinding.Forward) {
    target[outputOffset + 1] = b;
    target[outputOffset + 2] = c;
  } else if (winding === FlatGridWinding.Reverse) {
    target[outputOffset + 1] = c;
    target[outputOffset + 2] = b;
  } else {
    throw new Error(`未知的 Flat Grid 绕序：${String(winding)}`);
  }
  return outputOffset + 3;
}

/** 根据类型化策略解析当前单元格使用的对角线。 */
function usesBackwardDiagonal(
  diagonal: Readonly<FlatGridDiagonalPolicy>,
  column: number,
  row: number,
): boolean {
  switch (diagonal.kind) {
    case FlatGridDiagonalKind.FixedForward:
      return false;
    case FlatGridDiagonalKind.FixedBackward:
      return true;
    case FlatGridDiagonalKind.Alternating:
      return ((column + row + diagonal.parityOffset) & 1) !== 0;
    default:
      throw new Error(`未知的 Flat Grid 对角线策略：${String(diagonal)}`);
  }
}

/** 在分配 TypedArray 前校验网格尺寸和策略枚举。 */
function validateSpec(spec: Readonly<FlatGridPlanSpec>): void {
  if (!Number.isInteger(spec.columns) || spec.columns <= 0
    || !Number.isInteger(spec.rows) || spec.rows <= 0) {
    throw new Error('Flat Grid 的行列数量必须是正整数。');
  }
  const sampleCount = (spec.columns + 1) * (spec.rows + 1);
  const triangleIndexCount = spec.columns * spec.rows * 6;
  if (!Number.isSafeInteger(sampleCount) || sampleCount > 0xffffffff
    || !Number.isSafeInteger(triangleIndexCount)) {
    throw new Error('Flat Grid 固定拓扑容量超出安全范围。');
  }
  if (spec.diagonal.kind === FlatGridDiagonalKind.Alternating
    && spec.diagonal.parityOffset !== 0
    && spec.diagonal.parityOffset !== 1) {
    throw new Error('Flat Grid 交替对角线偏移只能是零或一。');
  }
}
