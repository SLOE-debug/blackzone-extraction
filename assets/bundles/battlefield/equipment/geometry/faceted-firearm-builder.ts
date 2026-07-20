import {
  emitOrientedFlatQuad,
  emitOrientedFlatTriangle,
} from '../../../../core/geometry/faceted/faceted-emitter';
import { type FacetedPoint } from '../../../../core/geometry/faceted/facet-orientation';
import {
  type FacetedColor,
  StaticFacetedMeshSink,
} from '../../../../core/geometry/faceted/static-faceted-mesh-sink';

/** 枪械侧轮廓中的领域化二维控制点。 */
export interface FirearmSilhouettePoint {
  readonly x: number;
  readonly y: number;
}

/** 把不规则枪械侧轮廓挤出为带独立硬边的低密度分面部件。 */
export function appendExtrudedFirearmSilhouette(
  sink: StaticFacetedMeshSink,
  points: readonly Readonly<FirearmSilhouettePoint>[],
  frontDepth: number,
  backDepth: number,
  faceColor: Readonly<FacetedColor>,
  edgeColor: Readonly<FacetedColor>,
  sideAccentColor: Readonly<FacetedColor>,
): void {
  if (points.length < 3) {
    throw new Error('枪械挤出轮廓至少需要三个控制点。');
  }
  let centerX = 0;
  let centerY = 0;
  for (const point of points) {
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
    emitOrientedFlatTriangle(sink, faceColor, frontCenter, frontCurrent, frontNext, 0, 0, 1);
    emitOrientedFlatTriangle(
      sink,
      index % 2 === 0 ? faceColor : edgeColor,
      backCenter,
      backNext,
      backCurrent,
      0,
      0,
      -1,
    );
    emitOrientedFlatQuad(
      sink,
      index % 3 === 0 ? sideAccentColor : edgeColor,
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
  points: readonly Readonly<FirearmSilhouettePoint>[],
  index: number,
): Readonly<FirearmSilhouettePoint> {
  const point = points[index];
  if (point === undefined) {
    throw new Error('枪械轮廓控制点索引越界。');
  }
  return point;
}

function point3(x: number, y: number, z: number): Readonly<FacetedPoint> {
  return Object.freeze({ x, y, z });
}

