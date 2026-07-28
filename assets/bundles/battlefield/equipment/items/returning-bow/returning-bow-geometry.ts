import {
  emitOrientedFlatQuad,
  emitOrientedFlatTriangle,
} from '../../../../../core/geometry/faceted/faceted-emitter';
import { type FacetedPoint } from '../../../../../core/geometry/faceted/facet-orientation';
import {
  type FacetedColor,
  StaticFacetedMeshSink,
} from '../../../../../core/geometry/faceted/static-faceted-mesh-sink';

const LIMB_PROFILE = Object.freeze([
  point(0, 0, 0),
  point(-0.12, 0.58, 0.04),
  point(-0.34, 1.22, -0.03),
  point(-0.48, 1.82, 0.06),
  point(-0.39, 2.28, 0.01),
]);
const LIMB_HALF_WIDTHS = Object.freeze([0.16, 0.145, 0.12, 0.09, 0.055]);
const LIMB_DEPTHS = Object.freeze([0.14, 0.13, 0.105, 0.08, 0.055]);
const PALETTE = Object.freeze({
  woodDark: color(0.12, 0.055, 0.025),
  wood: color(0.34, 0.14, 0.045),
  woodLight: color(0.57, 0.27, 0.07),
  inlay: color(0.91, 0.47, 0.08),
  string: color(0.78, 0.82, 0.74),
});

/** 生成非均匀反曲弓臂、偏心握把和实体弓弦组成的分面猎弓。 */
export function createReturningBowGeometry() {
  const sink = new StaticFacetedMeshSink();
  appendLimb(sink, 1);
  appendLimb(sink, -1);
  appendGrip(sink);
  appendString(sink);
  return sink.build();
}

function appendLimb(sink: StaticFacetedMeshSink, sign: -1 | 1): void {
  for (let section = 0; section < LIMB_PROFILE.length - 1; section++) {
    const current = requireValue(LIMB_PROFILE, section);
    const next = requireValue(LIMB_PROFILE, section + 1);
    const currentWidth = requireValue(LIMB_HALF_WIDTHS, section);
    const nextWidth = requireValue(LIMB_HALF_WIDTHS, section + 1);
    const currentDepth = requireValue(LIMB_DEPTHS, section);
    const nextDepth = requireValue(LIMB_DEPTHS, section + 1);
    const a = point(current.x, current.y * sign, -currentWidth);
    const b = point(current.x, current.y * sign, currentWidth);
    const c = point(next.x, next.y * sign, nextWidth);
    const d = point(next.x, next.y * sign, -nextWidth);
    emitOrientedFlatQuad(sink, section % 2 === 0 ? PALETTE.woodLight : PALETTE.wood, a, b, c, d, 1, 0, 0);
    emitOrientedFlatQuad(
      sink,
      PALETTE.woodDark,
      point(a.x - currentDepth, a.y, a.z),
      point(d.x - nextDepth, d.y, d.z),
      point(c.x - nextDepth, c.y, c.z),
      point(b.x - currentDepth, b.y, b.z),
      -1,
      0,
      0,
    );
  }
}

function appendGrip(sink: StaticFacetedMeshSink): void {
  emitOrientedFlatQuad(
    sink,
    PALETTE.woodDark,
    point(-0.2, -0.42, -0.2),
    point(-0.2, 0.38, -0.17),
    point(0.12, 0.34, 0.16),
    point(0.16, -0.46, 0.19),
    1,
    0,
    0,
  );
  emitOrientedFlatTriangle(
    sink,
    PALETTE.inlay,
    point(0.165, -0.31, 0.195),
    point(0.13, 0.27, 0.17),
    point(0.18, -0.02, 0.2),
    1,
    0,
    0,
  );
}

function appendString(sink: StaticFacetedMeshSink): void {
  appendStringSegment(sink, point(-0.39, 2.28, 0.01), point(0.28, 0, 0));
  appendStringSegment(sink, point(0.28, 0, 0), point(-0.39, -2.28, 0.01));
}

function appendStringSegment(
  sink: StaticFacetedMeshSink,
  start: Readonly<FacetedPoint>,
  end: Readonly<FacetedPoint>,
): void {
  const halfWidth = 0.018;
  emitOrientedFlatQuad(
    sink,
    PALETTE.string,
    point(start.x, start.y, start.z - halfWidth),
    point(start.x, start.y, start.z + halfWidth),
    point(end.x, end.y, end.z + halfWidth),
    point(end.x, end.y, end.z - halfWidth),
    1,
    0,
    0,
  );
}

function point(x: number, y: number, z: number): Readonly<FacetedPoint> {
  return Object.freeze({ x, y, z });
}

function color(red: number, green: number, blue: number): Readonly<FacetedColor> {
  return Object.freeze({ red, green, blue, alpha: 1 });
}

function requireValue<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) {
    throw new Error('归弦猎弓程序轮廓索引越界。');
  }
  return value;
}

/** 模块级复用的归弦猎弓固定拓扑。 */
export const RETURNING_BOW_GEOMETRY = createReturningBowGeometry();
