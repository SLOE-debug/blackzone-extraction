import {
  type FacetedPoint,
  getTriangleOrientation,
} from './facet-orientation';

const NORMAL_EPSILON = 0.000001;

/** 接收已经解析好位置与面法线的窄分面写入契约。 */
export interface FacetedTriangleSink<TMeta> {
  /**
   * 追加一个独立顶点三角形。
   *
   * @param meta Feature 自行解释的颜色、语义或变体元数据。
   */
  appendFlatTriangle(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
    normalX: number,
    normalY: number,
    normalZ: number,
    meta: TMeta,
  ): void;
}

/** 计算真实单位面法线并向 Sink 发射一个独立顶点三角形。 */
export function emitFlatTriangle<TMeta>(
  sink: FacetedTriangleSink<TMeta>,
  meta: TMeta,
  a: Readonly<FacetedPoint>,
  b: Readonly<FacetedPoint>,
  c: Readonly<FacetedPoint>,
): void {
  emitFlatTriangleCoordinates(
    sink,
    meta,
    a.x,
    a.y,
    a.z,
    b.x,
    b.y,
    b.z,
    c.x,
    c.y,
    c.z,
  );
}

/** 使用标量坐标计算真实单位面法线并发射三角形。 */
export function emitFlatTriangleCoordinates<TMeta>(
  sink: FacetedTriangleSink<TMeta>,
  meta: TMeta,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
): void {
  emitFlatTriangleCoordinatesInternal(
    sink, meta, ax, ay, az, bx, by, bz, cx, cy, cz, false,
  );
}

/**
 * 保持固定拓扑计数地发射三角形。
 *
 * 退化面仍写入三个位置，并沿用固定 epsilon 钳制后的法线；完全退化面写入零法线。
 * 本入口只供明确依赖稳定顶点数量的静态拓扑使用，非有限输入仍直接报错。
 */
export function emitFixedTopologyFlatTriangle<TMeta>(
  sink: FacetedTriangleSink<TMeta>,
  meta: TMeta,
  a: Readonly<FacetedPoint>,
  b: Readonly<FacetedPoint>,
  c: Readonly<FacetedPoint>,
): void {
  emitFixedTopologyFlatTriangleCoordinates(
    sink,
    meta,
    a.x,
    a.y,
    a.z,
    b.x,
    b.y,
    b.z,
    c.x,
    c.y,
    c.z,
  );
}

/** 使用标量坐标发射允许退化、但保持固定顶点数量的三角形。 */
export function emitFixedTopologyFlatTriangleCoordinates<TMeta>(
  sink: FacetedTriangleSink<TMeta>,
  meta: TMeta,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
): void {
  emitFlatTriangleCoordinatesInternal(
    sink, meta, ax, ay, az, bx, by, bz, cx, cy, cz, true,
  );
}

/** 根据显式退化策略计算法线并发射三角形。 */
function emitFlatTriangleCoordinatesInternal<TMeta>(
  sink: FacetedTriangleSink<TMeta>,
  meta: TMeta,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  preserveDegenerate: boolean,
): void {
  const edgeABX = bx - ax;
  const edgeABY = by - ay;
  const edgeABZ = bz - az;
  const edgeACX = cx - ax;
  const edgeACY = cy - ay;
  const edgeACZ = cz - az;
  const crossX = edgeABY * edgeACZ - edgeABZ * edgeACY;
  const crossY = edgeABZ * edgeACX - edgeABX * edgeACZ;
  const crossZ = edgeABX * edgeACY - edgeABY * edgeACX;
  const length = Math.hypot(crossX, crossY, crossZ);
  if (!Number.isFinite(length)) {
    throw new Error('程序化分面几何包含非有限三角形。');
  }
  if (!preserveDegenerate && length <= NORMAL_EPSILON) {
    throw new Error('程序化分面几何包含退化三角形。');
  }
  const inverseLength = 1 / Math.max(length, NORMAL_EPSILON);
  sink.appendFlatTriangle(
    ax,
    ay,
    az,
    bx,
    by,
    bz,
    cx,
    cy,
    cz,
    crossX * inverseLength,
    crossY * inverseLength,
    crossZ * inverseLength,
    meta,
  );
}

/** 根据期望朝外方向修正绕序后发射三角形。 */
export function emitOrientedFlatTriangle<TMeta>(
  sink: FacetedTriangleSink<TMeta>,
  meta: TMeta,
  a: Readonly<FacetedPoint>,
  b: Readonly<FacetedPoint>,
  c: Readonly<FacetedPoint>,
  outwardX: number,
  outwardY: number,
  outwardZ: number,
): void {
  if (getTriangleOrientation(a, b, c, outwardX, outwardY, outwardZ) >= 0) {
    emitFlatTriangle(sink, meta, a, b, c);
  } else {
    emitFlatTriangle(sink, meta, a, c, b);
  }
}

/** 按固定对角线把一个四边面发射为两个独立顶点三角形。 */
export function emitFlatQuad<TMeta>(
  sink: FacetedTriangleSink<TMeta>,
  meta: TMeta,
  a: Readonly<FacetedPoint>,
  b: Readonly<FacetedPoint>,
  c: Readonly<FacetedPoint>,
  d: Readonly<FacetedPoint>,
): void {
  emitFlatTriangle(sink, meta, a, b, c);
  emitFlatTriangle(sink, meta, a, c, d);
}

/** 根据期望朝外方向修正整体绕序后发射四边面。 */
export function emitOrientedFlatQuad<TMeta>(
  sink: FacetedTriangleSink<TMeta>,
  meta: TMeta,
  a: Readonly<FacetedPoint>,
  b: Readonly<FacetedPoint>,
  c: Readonly<FacetedPoint>,
  d: Readonly<FacetedPoint>,
  outwardX: number,
  outwardY: number,
  outwardZ: number,
): void {
  if (getTriangleOrientation(a, b, c, outwardX, outwardY, outwardZ) >= 0) {
    emitFlatQuad(sink, meta, a, b, c, d);
  } else {
    emitFlatQuad(sink, meta, a, d, c, b);
  }
}

/** 发射正反两组四边面，供薄片从任意观察侧保持可见。 */
export function emitDoubleSidedFlatQuad<TMeta>(
  sink: FacetedTriangleSink<TMeta>,
  meta: TMeta,
  a: Readonly<FacetedPoint>,
  b: Readonly<FacetedPoint>,
  c: Readonly<FacetedPoint>,
  d: Readonly<FacetedPoint>,
): void {
  emitFlatQuad(sink, meta, a, b, c, d);
  emitFlatQuad(sink, meta, d, c, b, a);
}
