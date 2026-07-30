/** 大锤沿柄轴变化的七边截面。 */
export interface SledgehammerHandleRing {
  readonly y: number;
  readonly centerX: number;
  readonly centerZ: number;
  readonly radiusX: number;
  readonly radiusZ: number;
  readonly twist: number;
}

/** 锤头沿局部 X 轴变化的不等轮廓截面。 */
export interface SledgehammerHeadRing {
  readonly x: number;
  readonly scaleY: number;
  readonly scaleZ: number;
  readonly shiftY: number;
  readonly shiftZ: number;
  readonly twist: number;
}

/** 锤头 YZ 平面的破岩轮廓点。 */
export interface SledgehammerHeadOutlinePoint {
  readonly y: number;
  readonly z: number;
}

export const SLEDGEHAMMER_HANDLE_SEGMENTS = 7;

/** 从主握点延伸到锤头连接槽的稳定柄部轮廓。 */
export const SLEDGEHAMMER_HANDLE_RINGS = Object.freeze([
  ring(0.2, -0.006, 0.008, 0.145, 0.125, 0.02),
  ring(-0.08, 0.008, -0.006, 0.13, 0.112, -0.025),
  ring(-0.48, -0.012, 0.011, 0.142, 0.121, 0.035),
  ring(-0.94, 0.014, -0.012, 0.135, 0.116, -0.04),
  ring(-1.42, -0.015, 0.012, 0.108, 0.097, 0.025),
  ring(-2.05, 0.01, -0.014, 0.096, 0.088, -0.035),
  ring(-2.62, -0.012, 0.008, 0.125, 0.108, 0.045),
] satisfies readonly SledgehammerHandleRing[]);

/** 锤柄末端包入锤头的外凸金属护环。 */
export const SLEDGEHAMMER_COLLAR_RINGS = Object.freeze([
  ring(-2.55, -0.01, 0.008, 0.145, 0.13, 0.015),
  ring(-2.74, 0.012, -0.008, 0.205, 0.178, -0.02),
  ring(-3.02, -0.008, 0.006, 0.255, 0.218, 0.025),
  ring(-3.28, 0.006, -0.004, 0.215, 0.188, -0.015),
] satisfies readonly SledgehammerHandleRing[]);

/** 六层纵向截面形成内收肩部、宽主体与破损端面。 */
export const SLEDGEHAMMER_HEAD_RINGS = Object.freeze([
  headRing(-1.46, 0.57, 0.52, 0.035, -0.045, -0.025),
  headRing(-1.22, 0.73, 0.67, -0.025, 0.028, 0.018),
  headRing(-0.94, 0.88, 0.81, 0.018, -0.012, -0.012),
  headRing(0.92, 0.84, 0.78, -0.022, 0.018, 0.014),
  headRing(1.2, 0.7, 0.65, 0.032, -0.026, -0.018),
  headRing(1.45, 0.54, 0.49, -0.028, 0.04, 0.024),
] satisfies readonly SledgehammerHeadRing[]);

/** 九点非对称轮廓让锤头具有顶部缺角、宽肩和下部破面。 */
export const SLEDGEHAMMER_HEAD_OUTLINE = Object.freeze([
  outline(-0.06, -0.9),
  outline(0.72, -0.78),
  outline(1.08, -0.22),
  outline(0.86, 0.48),
  outline(0.28, 0.86),
  outline(-0.36, 0.8),
  outline(-0.91, 0.39),
  outline(-1.02, -0.31),
  outline(-0.58, -0.82),
] satisfies readonly SledgehammerHeadOutlinePoint[]);

function ring(
  y: number,
  centerX: number,
  centerZ: number,
  radiusX: number,
  radiusZ: number,
  twist: number,
): SledgehammerHandleRing {
  return Object.freeze({ y, centerX, centerZ, radiusX, radiusZ, twist });
}

function headRing(
  x: number,
  scaleY: number,
  scaleZ: number,
  shiftY: number,
  shiftZ: number,
  twist: number,
): SledgehammerHeadRing {
  return Object.freeze({ x, scaleY, scaleZ, shiftY, shiftZ, twist });
}

function outline(y: number, z: number): SledgehammerHeadOutlinePoint {
  return Object.freeze({ y, z });
}
