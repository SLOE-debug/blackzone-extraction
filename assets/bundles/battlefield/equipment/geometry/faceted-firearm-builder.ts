import {
  emitOrientedFlatQuad,
  emitOrientedFlatTriangle,
} from '../../../../core/geometry/faceted/faceted-emitter';
import {
  appendExtrudedFacetedSilhouette,
  type FacetedSilhouettePoint,
} from '../../../../core/geometry/faceted/faceted-extruded-silhouette';
import { type FacetedPoint } from '../../../../core/geometry/faceted/facet-orientation';
import {
  type FacetedColor,
  StaticFacetedMeshSink,
} from '../../../../core/geometry/faceted/static-faceted-mesh-sink';

/** 枪管沿局部 X 轴变化时使用的非均匀截面环。 */
export interface FacetedFirearmTubeRing {
  readonly x: number;
  readonly centerY: number;
  readonly centerZ: number;
  readonly radiusY: number;
  readonly radiusZ: number;
  readonly rotation: number;
}

/** 枪身二维领域轮廓及其分面材质。 */
export interface FacetedFirearmSilhouette {
  readonly points: readonly Readonly<FacetedSilhouettePoint>[];
  readonly frontDepth: number;
  readonly backDepth: number;
  readonly faceColor: Readonly<FacetedColor>;
  readonly edgeColor: Readonly<FacetedColor>;
  readonly accentColor: Readonly<FacetedColor>;
}

/** 把枪械领域轮廓写入静态硬边网格。 */
export function appendFacetedFirearmSilhouette(
  sink: StaticFacetedMeshSink,
  silhouette: Readonly<FacetedFirearmSilhouette>,
): void {
  appendExtrudedFacetedSilhouette(
    sink,
    silhouette.points,
    silhouette.frontDepth,
    silhouette.backDepth,
    silhouette.faceColor,
    silhouette.edgeColor,
    silhouette.accentColor,
  );
}

/**
 * 写入低段数、偏心、椭圆截面的枪管或消音器。
 *
 * 每一环允许独立错角与长短半径，避免最终轮廓退化为规则 Cylinder。
 */
export function appendIrregularFirearmTube(
  sink: StaticFacetedMeshSink,
  rings: readonly Readonly<FacetedFirearmTubeRing>[],
  segmentCount: number,
  baseColor: Readonly<FacetedColor>,
  accentColor: Readonly<FacetedColor>,
): void {
  validateTube(rings, segmentCount);
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex++) {
    const current = requireRing(rings, ringIndex);
    const next = requireRing(rings, ringIndex + 1);
    for (let segment = 0; segment < segmentCount; segment++) {
      const nextSegment = (segment + 1) % segmentCount;
      const angle = (segment + 0.5) / segmentCount * Math.PI * 2;
      emitOrientedFlatQuad(
        sink,
        (segment + ringIndex) % 3 === 0 ? accentColor : baseColor,
        sampleTubePoint(current, ringIndex, segment, segmentCount, 1),
        sampleTubePoint(next, ringIndex + 1, segment, segmentCount, 1),
        sampleTubePoint(next, ringIndex + 1, nextSegment, segmentCount, 1),
        sampleTubePoint(current, ringIndex, nextSegment, segmentCount, 1),
        0,
        Math.cos(angle),
        Math.sin(angle),
      );
    }
  }
}

/** 在管体末端写入有厚度的枪口环和向内延伸的真实膛孔。 */
export function appendFacetedMuzzleBore(
  sink: StaticFacetedMeshSink,
  muzzle: Readonly<FacetedFirearmTubeRing>,
  segmentCount: number,
  boreRadiusScale: number,
  tunnelDepth: number,
  rimColor: Readonly<FacetedColor>,
  boreColor: Readonly<FacetedColor>,
): void {
  if (!Number.isFinite(boreRadiusScale)
    || boreRadiusScale <= 0
    || boreRadiusScale >= 0.85
    || !Number.isFinite(tunnelDepth)
    || tunnelDepth <= 0) {
    throw new Error('枪口内膛比例和深度必须位于有效范围。');
  }
  for (let segment = 0; segment < segmentCount; segment++) {
    const next = (segment + 1) % segmentCount;
    const angle = (segment + 0.5) / segmentCount * Math.PI * 2;
    const outerCurrent = sampleTubePoint(muzzle, 0, segment, segmentCount, 1.035);
    const outerNext = sampleTubePoint(muzzle, 0, next, segmentCount, 1.035);
    const innerCurrent = sampleTubePoint(muzzle, 0, segment, segmentCount, boreRadiusScale);
    const innerNext = sampleTubePoint(muzzle, 0, next, segmentCount, boreRadiusScale);
    const tunnelCurrent = offsetPoint(innerCurrent, -tunnelDepth);
    const tunnelNext = offsetPoint(innerNext, -tunnelDepth);
    emitOrientedFlatQuad(
      sink,
      segment % 2 === 0 ? rimColor : boreColor,
      outerCurrent,
      outerNext,
      innerNext,
      innerCurrent,
      1,
      0,
      0,
    );
    emitOrientedFlatQuad(
      sink,
      boreColor,
      innerCurrent,
      innerNext,
      tunnelNext,
      tunnelCurrent,
      0,
      -Math.cos(angle),
      -Math.sin(angle),
    );
  }
}

/** 沿开放折线写入带真实中空负形的扳机护圈。 */
export function appendFacetedTriggerGuard(
  sink: StaticFacetedMeshSink,
  centerLine: readonly Readonly<FacetedSilhouettePoint>[],
  thickness: number,
  frontDepth: number,
  backDepth: number,
  color: Readonly<FacetedColor>,
  accentColor: Readonly<FacetedColor>,
): void {
  if (centerLine.length < 3
    || !Number.isFinite(thickness)
    || thickness <= 0
    || frontDepth <= 0
    || backDepth <= 0) {
    throw new Error('扳机护圈折线、厚度和挤出深度无效。');
  }
  for (let index = 0; index < centerLine.length - 1; index++) {
    const start = requirePoint(centerLine, index);
    const end = requirePoint(centerLine, index + 1);
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const length = Math.hypot(deltaX, deltaY);
    if (length <= Number.EPSILON) {
      throw new Error('扳机护圈不能包含重合控制点。');
    }
    const normalX = -deltaY / length * thickness * 0.5;
    const normalY = deltaX / length * thickness * 0.5;
    const frontA = point3(start.x + normalX, start.y + normalY, frontDepth);
    const frontB = point3(end.x + normalX, end.y + normalY, frontDepth);
    const frontC = point3(end.x - normalX, end.y - normalY, frontDepth);
    const frontD = point3(start.x - normalX, start.y - normalY, frontDepth);
    const backA = point3(start.x + normalX, start.y + normalY, -backDepth);
    const backB = point3(end.x + normalX, end.y + normalY, -backDepth);
    const backC = point3(end.x - normalX, end.y - normalY, -backDepth);
    const backD = point3(start.x - normalX, start.y - normalY, -backDepth);
    const segmentColor = index % 2 === 0 ? color : accentColor;
    emitOrientedFlatQuad(sink, segmentColor, frontA, frontB, frontC, frontD, 0, 0, 1);
    emitOrientedFlatQuad(sink, color, backD, backC, backB, backA, 0, 0, -1);
    emitOrientedFlatQuad(
      sink, color, backA, frontA, frontB, backB, normalX, normalY, 0,
    );
    emitOrientedFlatQuad(
      sink, accentColor, frontD, backD, backC, frontC, -normalX, -normalY, 0,
    );
  }
}

/** 写入一列错落短齿，形成放大展示时可读的战术导轨。 */
export function appendFacetedTopRail(
  sink: StaticFacetedMeshSink,
  startX: number,
  endX: number,
  baseY: number,
  toothCount: number,
  depth: number,
  color: Readonly<FacetedColor>,
  accentColor: Readonly<FacetedColor>,
): void {
  if (!Number.isFinite(startX)
    || !Number.isFinite(endX)
    || endX <= startX
    || !Number.isInteger(toothCount)
    || toothCount < 2) {
    throw new Error('枪械导轨范围与齿数无效。');
  }
  const pitch = (endX - startX) / toothCount;
  for (let index = 0; index < toothCount; index++) {
    const left = startX + pitch * index + pitch * 0.08;
    const right = startX + pitch * (index + 1) - pitch * 0.12;
    appendExtrudedFacetedSilhouette(
      sink,
      Object.freeze([
        Object.freeze({ x: left, y: baseY }),
        Object.freeze({ x: left + pitch * 0.14, y: baseY + 0.105 + (index % 2) * 0.012 }),
        Object.freeze({ x: right - pitch * 0.1, y: baseY + 0.098 }),
        Object.freeze({ x: right, y: baseY }),
      ]),
      depth,
      depth * 0.94,
      index % 3 === 0 ? accentColor : color,
      color,
      accentColor,
    );
  }
}

/** 在枪身表面写入不增加厚重轮廓的语义色块或机械刻面。 */
export function appendFacetedSurfacePanel(
  sink: StaticFacetedMeshSink,
  points: readonly Readonly<FacetedSilhouettePoint>[],
  z: number,
  color: Readonly<FacetedColor>,
): void {
  if (points.length < 3) {
    throw new Error('枪械表面面板至少需要三个控制点。');
  }
  const first = requirePoint(points, 0);
  for (let index = 1; index < points.length - 1; index++) {
    const current = requirePoint(points, index);
    const next = requirePoint(points, index + 1);
    emitOrientedFlatTriangle(
      sink,
      color,
      point3(first.x, first.y, z),
      point3(current.x, current.y, z),
      point3(next.x, next.y, z),
      0,
      0,
      z >= 0 ? 1 : -1,
    );
  }
}

function sampleTubePoint(
  ring: Readonly<FacetedFirearmTubeRing>,
  ringIndex: number,
  segment: number,
  segmentCount: number,
  radiusScale: number,
): Readonly<FacetedPoint> {
  const angle = segment / segmentCount * Math.PI * 2 + ring.rotation;
  const variation = 1 + (((segment * 7 + ringIndex * 5) % 5) - 2) * 0.016;
  return point3(
    ring.x,
    ring.centerY + Math.cos(angle) * ring.radiusY * variation * radiusScale,
    ring.centerZ + Math.sin(angle) * ring.radiusZ * variation * radiusScale,
  );
}

function validateTube(
  rings: readonly Readonly<FacetedFirearmTubeRing>[],
  segmentCount: number,
): void {
  if (rings.length < 2 || !Number.isInteger(segmentCount) || segmentCount < 5) {
    throw new Error('枪管至少需要两个截面环和五个分段。');
  }
  for (const ring of rings) {
    if (![ring.x, ring.centerY, ring.centerZ, ring.radiusY, ring.radiusZ, ring.rotation]
      .every(Number.isFinite)
      || ring.radiusY <= 0
      || ring.radiusZ <= 0) {
      throw new Error('枪管截面必须使用有限坐标和正半径。');
    }
  }
}

function requireRing(
  rings: readonly Readonly<FacetedFirearmTubeRing>[],
  index: number,
): Readonly<FacetedFirearmTubeRing> {
  const ring = rings[index];
  if (ring === undefined) {
    throw new Error('枪管截面环索引越界。');
  }
  return ring;
}

function requirePoint(
  points: readonly Readonly<FacetedSilhouettePoint>[],
  index: number,
): Readonly<FacetedSilhouettePoint> {
  const point = points[index];
  if (point === undefined) {
    throw new Error('枪械轮廓控制点索引越界。');
  }
  return point;
}

function offsetPoint(point: Readonly<FacetedPoint>, offsetX: number): Readonly<FacetedPoint> {
  return point3(point.x + offsetX, point.y, point.z);
}

function point3(x: number, y: number, z: number): Readonly<FacetedPoint> {
  return Object.freeze({ x, y, z });
}
