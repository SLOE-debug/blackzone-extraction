import {
  emitOrientedFlatQuad,
  emitOrientedFlatTriangle,
} from '../../../../core/geometry/faceted/faceted-emitter';
import { type FacetedPoint } from '../../../../core/geometry/faceted/facet-orientation';
import {
  type FacetedColor,
  StaticFacetedMeshSink,
} from '../../../../core/geometry/faceted/static-faceted-mesh-sink';
import {
  appendExtrudedFirearmSilhouette,
  type FirearmSilhouettePoint,
} from './faceted-firearm-builder';

const PALETTE = Object.freeze({
  slideDark: Object.freeze({ red: 0.12, green: 0.13, blue: 0.145, alpha: 1 }),
  slide: Object.freeze({ red: 0.28, green: 0.3, blue: 0.325, alpha: 1 }),
  slideLight: Object.freeze({ red: 0.48, green: 0.5, blue: 0.52, alpha: 1 }),
  frame: Object.freeze({ red: 0.17, green: 0.18, blue: 0.19, alpha: 1 }),
  gripDark: Object.freeze({ red: 0.085, green: 0.052, blue: 0.035, alpha: 1 }),
  grip: Object.freeze({ red: 0.21, green: 0.12, blue: 0.07, alpha: 1 }),
  bore: Object.freeze({ red: 0.018, green: 0.02, blue: 0.023, alpha: 1 }),
  epic: Object.freeze({ red: 0.47, green: 0.16, blue: 0.78, alpha: 1 }),
} satisfies Readonly<Record<string, Readonly<FacetedColor>>>);

const SLIDE = Object.freeze([
  Object.freeze({ x: -1.58, y: 0.1 }),
  Object.freeze({ x: -1.43, y: 0.43 }),
  Object.freeze({ x: -0.62, y: 0.51 }),
  Object.freeze({ x: 1.32, y: 0.47 }),
  Object.freeze({ x: 1.58, y: 0.29 }),
  Object.freeze({ x: 1.52, y: 0.04 }),
  Object.freeze({ x: 0.51, y: -0.035 }),
  Object.freeze({ x: -1.27, y: -0.02 }),
] satisfies readonly FirearmSilhouettePoint[]);

const FRAME = Object.freeze([
  Object.freeze({ x: -1.27, y: -0.02 }),
  Object.freeze({ x: 0.76, y: -0.04 }),
  Object.freeze({ x: 0.68, y: -0.3 }),
  Object.freeze({ x: 0.15, y: -0.43 }),
  Object.freeze({ x: -0.73, y: -0.34 }),
  Object.freeze({ x: -1.34, y: -0.16 }),
] satisfies readonly FirearmSilhouettePoint[]);

const GRIP = Object.freeze([
  Object.freeze({ x: -0.74, y: -0.26 }),
  Object.freeze({ x: 0.08, y: -0.34 }),
  Object.freeze({ x: -0.04, y: -1.17 }),
  Object.freeze({ x: -0.36, y: -1.5 }),
  Object.freeze({ x: -0.73, y: -1.4 }),
  Object.freeze({ x: -0.96, y: -0.55 }),
] satisfies readonly FirearmSilhouettePoint[]);

/** 编译具有厚重滑套、倾斜握把、镂空扳机护圈和多边形枪口的沙漠之鹰。 */
export function createDesertEagleGeometry() {
  const sink = new StaticFacetedMeshSink();
  appendExtrudedFirearmSilhouette(
    sink, SLIDE, 0.18, 0.1692, PALETTE.slide, PALETTE.slideDark, PALETTE.slideLight,
  );
  appendExtrudedFirearmSilhouette(
    sink, FRAME, 0.205, 0.1927, PALETTE.frame, PALETTE.slideDark, PALETTE.slideLight,
  );
  appendExtrudedFirearmSilhouette(
    sink, GRIP, 0.17, 0.1598, PALETTE.grip, PALETTE.gripDark, PALETTE.slideLight,
  );
  appendTriggerGuard(sink);
  appendMuzzle(sink);
  appendSights(sink);
  appendEpicInlay(sink);
  return sink.build();
}

/** 写入六段式扳机护圈，内环保持真实通孔。 */
function appendTriggerGuard(sink: StaticFacetedMeshSink): void {
  const outer = Object.freeze([
    Object.freeze({ x: 0.02, y: -0.31 }),
    Object.freeze({ x: 0.72, y: -0.28 }),
    Object.freeze({ x: 0.87, y: -0.47 }),
    Object.freeze({ x: 0.64, y: -0.73 }),
    Object.freeze({ x: 0.08, y: -0.7 }),
    Object.freeze({ x: -0.08, y: -0.51 }),
  ] satisfies readonly FirearmSilhouettePoint[]);
  const inner = Object.freeze([
    Object.freeze({ x: 0.14, y: -0.4 }),
    Object.freeze({ x: 0.58, y: -0.39 }),
    Object.freeze({ x: 0.7, y: -0.49 }),
    Object.freeze({ x: 0.53, y: -0.61 }),
    Object.freeze({ x: 0.18, y: -0.6 }),
    Object.freeze({ x: 0.07, y: -0.5 }),
  ] satisfies readonly FirearmSilhouettePoint[]);
  const frontZ = 0.19;
  const backZ = -0.18;
  for (let index = 0; index < outer.length; index++) {
    const next = (index + 1) % outer.length;
    const outerCurrent = requireSilhouettePoint(outer, index);
    const outerNext = requireSilhouettePoint(outer, next);
    const innerCurrent = requireSilhouettePoint(inner, index);
    const innerNext = requireSilhouettePoint(inner, next);
    emitOrientedFlatQuad(
      sink,
      PALETTE.frame,
      point3(outerCurrent.x, outerCurrent.y, frontZ),
      point3(outerNext.x, outerNext.y, frontZ),
      point3(innerNext.x, innerNext.y, frontZ),
      point3(innerCurrent.x, innerCurrent.y, frontZ),
      0,
      0,
      1,
    );
    emitOrientedFlatQuad(
      sink,
      PALETTE.slideDark,
      point3(outerCurrent.x, outerCurrent.y, backZ),
      point3(innerCurrent.x, innerCurrent.y, backZ),
      point3(innerNext.x, innerNext.y, backZ),
      point3(outerNext.x, outerNext.y, backZ),
      0,
      0,
      -1,
    );
    emitOrientedFlatQuad(
      sink,
      PALETTE.slideDark,
      point3(innerCurrent.x, innerCurrent.y, backZ),
      point3(innerCurrent.x, innerCurrent.y, frontZ),
      point3(innerNext.x, innerNext.y, frontZ),
      point3(innerNext.x, innerNext.y, backZ),
      0.4 - (innerCurrent.x + innerNext.x) * 0.5,
      -0.5 - (innerCurrent.y + innerNext.y) * 0.5,
      0,
    );
  }
}

/** 枪口使用不等半径八边环和向内收束的真实膛孔。 */
function appendMuzzle(sink: StaticFacetedMeshSink): void {
  const segmentCount = 8;
  for (let segment = 0; segment < segmentCount; segment++) {
    const next = (segment + 1) % segmentCount;
    const outerCurrent = muzzlePoint(1.61, segment, 0.225, 1);
    const outerNext = muzzlePoint(1.61, next, 0.225, 1);
    const innerCurrent = muzzlePoint(1.615, segment, 0.105, 0);
    const innerNext = muzzlePoint(1.615, next, 0.105, 0);
    const tunnelCurrent = muzzlePoint(1.39, segment, 0.088, 0);
    const tunnelNext = muzzlePoint(1.39, next, 0.088, 0);
    emitOrientedFlatQuad(
      sink,
      segment % 2 === 0 ? PALETTE.slideLight : PALETTE.slide,
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
      PALETTE.bore,
      innerCurrent,
      innerNext,
      tunnelNext,
      tunnelCurrent,
      -1,
      0,
      0,
    );
  }
}

function appendSights(sink: StaticFacetedMeshSink): void {
  appendExtrudedFirearmSilhouette(
    sink,
    Object.freeze([
      Object.freeze({ x: -1.23, y: 0.43 }),
      Object.freeze({ x: -1.06, y: 0.6 }),
      Object.freeze({ x: -0.86, y: 0.57 }),
      Object.freeze({ x: -0.78, y: 0.47 }),
    ]),
    0.1,
    0.1,
    PALETTE.slideDark,
    PALETTE.slideDark,
    PALETTE.slideLight,
  );
  appendExtrudedFirearmSilhouette(
    sink,
    Object.freeze([
      Object.freeze({ x: 1.08, y: 0.46 }),
      Object.freeze({ x: 1.2, y: 0.58 }),
      Object.freeze({ x: 1.34, y: 0.54 }),
      Object.freeze({ x: 1.39, y: 0.46 }),
    ]),
    0.075,
    0.075,
    PALETTE.slideLight,
    PALETTE.slideDark,
    PALETTE.slideLight,
  );
}

/** 在握把侧面嵌入紫色三角品质刻印。 */
function appendEpicInlay(sink: StaticFacetedMeshSink): void {
  emitOrientedFlatTriangle(
    sink,
    PALETTE.epic,
    point3(-0.63, -0.65, 0.176),
    point3(-0.24, -0.82, 0.176),
    point3(-0.52, -1.12, 0.176),
    0,
    0,
    1,
  );
}

function muzzlePoint(
  x: number,
  segment: number,
  radius: number,
  variation: number,
): Readonly<FacetedPoint> {
  const angle = segment / 8 * Math.PI * 2 + 0.08;
  const variedRadius = radius * (1 + ((segment * 5) % 3 - 1) * 0.045 * variation);
  return point3(x, 0.205 + Math.cos(angle) * variedRadius, Math.sin(angle) * variedRadius);
}

function requireSilhouettePoint(
  points: readonly Readonly<FirearmSilhouettePoint>[],
  index: number,
): Readonly<FirearmSilhouettePoint> {
  const point = points[index];
  if (point === undefined) {
    throw new Error('沙漠之鹰轮廓索引越界。');
  }
  return point;
}

function point3(x: number, y: number, z: number): Readonly<FacetedPoint> {
  return Object.freeze({ x, y, z });
}

/** 模块级复用的沙漠之鹰固定拓扑。 */
export const DESERT_EAGLE_GEOMETRY = createDesertEagleGeometry();
