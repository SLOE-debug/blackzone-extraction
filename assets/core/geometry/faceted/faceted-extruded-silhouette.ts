import {
  emitOrientedFlatQuad,
  emitOrientedFlatTriangle,
  type FacetedTriangleSink,
} from './faceted-emitter';
import { type FacetedPoint } from './facet-orientation';

/** 可沿局部 Z 方向挤出的二维轮廓控制点。 */
export interface FacetedSilhouettePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * 把任意不规则二维轮廓挤出为带独立硬边的低密度分面部件。
 *
 * @param sink 接收独立三角形的目标。
 * @param points 按轮廓边界顺序排列的控制点。
 * @param frontDepth 正 Z 方向的挤出深度。
 * @param backDepth 负 Z 方向的挤出深度绝对值。
 * @param faceMeta 正面三角形元数据。
 * @param edgeMeta 背面与普通侧边元数据。
 * @param accentMeta 每三段交替一次的侧边强调元数据。
 */
export function appendExtrudedFacetedSilhouette<TMeta>(
  sink: FacetedTriangleSink<TMeta>,
  points: readonly Readonly<FacetedSilhouettePoint>[],
  frontDepth: number,
  backDepth: number,
  faceMeta: TMeta,
  edgeMeta: TMeta,
  accentMeta: TMeta,
): void {
  if (points.length < 3
    || !Number.isFinite(frontDepth)
    || !Number.isFinite(backDepth)
    || frontDepth <= 0
    || backDepth <= 0) {
    throw new Error('分面挤出轮廓至少需要三个控制点和有效的正反深度。');
  }
  let centerX = 0;
  let centerY = 0;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new Error('分面挤出轮廓控制点必须使用有限坐标。');
    }
    centerX += point.x;
    centerY += point.y;
  }
  centerX /= points.length;
  centerY /= points.length;
  const frontCenter = point3(centerX, centerY, frontDepth);
  const backCenter = point3(centerX, centerY, -backDepth);
  for (let index = 0; index < points.length; index++) {
    const next = (index + 1) % points.length;
    const currentPoint = requirePoint(points, index);
    const nextPoint = requirePoint(points, next);
    const frontCurrent = point3(currentPoint.x, currentPoint.y, frontDepth);
    const frontNext = point3(nextPoint.x, nextPoint.y, frontDepth);
    const backCurrent = point3(currentPoint.x, currentPoint.y, -backDepth);
    const backNext = point3(nextPoint.x, nextPoint.y, -backDepth);
    emitOrientedFlatTriangle(
      sink,
      faceMeta,
      frontCenter,
      frontCurrent,
      frontNext,
      0,
      0,
      1,
    );
    emitOrientedFlatTriangle(
      sink,
      index % 2 === 0 ? faceMeta : edgeMeta,
      backCenter,
      backNext,
      backCurrent,
      0,
      0,
      -1,
    );
    emitOrientedFlatQuad(
      sink,
      index % 3 === 0 ? accentMeta : edgeMeta,
      backCurrent,
      frontCurrent,
      frontNext,
      backNext,
      (currentPoint.x + nextPoint.x) * 0.5 - centerX,
      (currentPoint.y + nextPoint.y) * 0.5 - centerY,
      0,
    );
  }
}

function requirePoint(
  points: readonly Readonly<FacetedSilhouettePoint>[],
  index: number,
): Readonly<FacetedSilhouettePoint> {
  const point = points[index];
  if (point === undefined) {
    throw new Error('分面挤出轮廓控制点索引越界。');
  }
  return point;
}

function point3(x: number, y: number, z: number): Readonly<FacetedPoint> {
  return Object.freeze({ x, y, z });
}
