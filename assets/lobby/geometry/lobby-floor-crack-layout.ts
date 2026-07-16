/** 地面裂纹折线路径中的单个控制点。 */
export interface LobbyFloorCrackPoint {
  readonly x: number;
  readonly z: number;
  readonly widthScale: number;
}

/** 一条固定地面裂纹的宽度与折线路径。 */
export interface LobbyFloorCrackPath {
  readonly width: number;
  readonly points: readonly LobbyFloorCrackPoint[];
}

/**
 * 大厅地面的固定裂纹路径。
 *
 * 路径直接使用大厅局部坐标，不读取运行时随机状态，因此刷新场景后形状保持一致。
 */
export const LOBBY_FLOOR_CRACK_PATHS: readonly LobbyFloorCrackPath[] = Object.freeze([
  createCrackPath(0.24, [
    createCrackPoint(-7.8, -7.4, 0.18),
    createCrackPoint(-6.35, -6.25, 0.72),
    createCrackPoint(-4.55, -6.7, 1),
    createCrackPoint(-2.9, -5.05, 0.82),
    createCrackPoint(-0.8, -5.55, 0.68),
    createCrackPoint(0.75, -3.75, 0.46),
    createCrackPoint(2.35, -3.15, 0.16),
  ]),
  createCrackPath(0.17, [
    createCrackPoint(-2.95, -5.08, 0.7),
    createCrackPoint(-3.7, -2.9, 1),
    createCrackPoint(-2.85, -0.75, 0.72),
    createCrackPoint(-3.5, 1.45, 0.48),
    createCrackPoint(-2.65, 3.3, 0.14),
  ]),
  createCrackPath(0.13, [
    createCrackPoint(-0.82, -5.52, 0.78),
    createCrackPoint(0.15, -6.95, 1),
    createCrackPoint(1.9, -7.65, 0.72),
    createCrackPoint(3.55, -7.2, 0.45),
    createCrackPoint(4.65, -8.35, 0.12),
  ]),
  createCrackPath(0.2, [
    createCrackPoint(5.95, 0.8, 0.15),
    createCrackPoint(4.55, 1.65, 0.6),
    createCrackPoint(4.9, 3.45, 1),
    createCrackPoint(3.55, 5.05, 0.78),
    createCrackPoint(4.1, 7.15, 0.52),
    createCrackPoint(3.25, 8.65, 0.14),
  ]),
  createCrackPath(0.12, [
    createCrackPoint(4.88, 3.42, 0.72),
    createCrackPoint(6.35, 4.4, 1),
    createCrackPoint(7.25, 6.15, 0.58),
    createCrackPoint(7.75, 7.85, 0.12),
  ]),
  createCrackPath(0.18, [
    createCrackPoint(-8.35, 9.25, 0.14),
    createCrackPoint(-6.85, 7.65, 0.62),
    createCrackPoint(-7.25, 5.45, 1),
    createCrackPoint(-5.75, 3.75, 0.7),
    createCrackPoint(-6.15, 1.85, 0.16),
  ]),
  createCrackPath(0.1, [
    createCrackPoint(-7.22, 5.48, 0.72),
    createCrackPoint(-8.18, 4.02, 1),
    createCrackPoint(-8.52, 2.15, 0.14),
  ]),
  createCrackPath(0.14, [
    createCrackPoint(-1.65, 9.55, 0.12),
    createCrackPoint(-0.72, 7.75, 0.55),
    createCrackPoint(-1.45, 6.05, 1),
    createCrackPoint(-0.45, 4.35, 0.65),
    createCrackPoint(-1.35, 2.55, 0.14),
  ]),
  createCrackPath(0.16, [
    createCrackPoint(1.05, 9.6, 0.12),
    createCrackPoint(1.85, 8.05, 0.58),
    createCrackPoint(0.92, 6.55, 1),
    createCrackPoint(2.18, 5.05, 0.68),
    createCrackPoint(1.42, 3.35, 0.15),
  ]),
  createCrackPath(0.17, [
    createCrackPoint(8.05, -9.45, 0.14),
    createCrackPoint(6.65, -7.72, 0.62),
    createCrackPoint(7.25, -5.9, 1),
    createCrackPoint(5.82, -4.38, 0.7),
    createCrackPoint(6.38, -2.55, 0.16),
  ]),
  createCrackPath(0.09, [
    createCrackPoint(6.68, -7.7, 0.7),
    createCrackPoint(5.42, -8.82, 1),
    createCrackPoint(4.18, -9.72, 0.12),
  ]),
  createCrackPath(0.13, [
    createCrackPoint(-8.42, -1.65, 0.14),
    createCrackPoint(-7.05, -2.82, 0.68),
    createCrackPoint(-7.48, -4.58, 1),
    createCrackPoint(-5.92, -5.78, 0.13),
  ]),
  createCrackPath(0.15, [
    createCrackPoint(8.48, -0.48, 0.14),
    createCrackPoint(7.08, 0.62, 0.65),
    createCrackPoint(7.58, 2.42, 1),
    createCrackPoint(6.25, 3.72, 0.14),
  ]),
  createCrackPath(0.09, [
    createCrackPoint(7.55, 2.4, 0.7),
    createCrackPoint(8.38, 3.92, 1),
    createCrackPoint(8.08, 5.72, 0.12),
  ]),
]);

/** 固定裂纹拓扑包含的线段总数。 */
export const LOBBY_FLOOR_CRACK_SEGMENT_COUNT = LOBBY_FLOOR_CRACK_PATHS.reduce(
  (count, path) => count + path.points.length - 1,
  0,
);

/**
 * 创建冻结后的裂纹路径。
 *
 * @param width 路径的基础全宽。
 * @param points 按连接顺序排列的控制点。
 * @returns 不允许在几何写入阶段修改的裂纹路径。
 */
function createCrackPath(
  width: number,
  points: readonly LobbyFloorCrackPoint[],
): LobbyFloorCrackPath {
  return Object.freeze({
    width,
    points: Object.freeze(points),
  });
}

/**
 * 创建冻结后的裂纹控制点。
 *
 * @param x 大厅局部 X 坐标。
 * @param z 大厅局部 Z 坐标。
 * @param widthScale 此处相对路径基础宽度的缩放。
 * @returns 不允许在几何写入阶段修改的控制点。
 */
function createCrackPoint(
  x: number,
  z: number,
  widthScale: number,
): LobbyFloorCrackPoint {
  return Object.freeze({ x, z, widthScale });
}
