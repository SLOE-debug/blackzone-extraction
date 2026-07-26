import {
  emitOrientedFlatQuad,
  emitOrientedFlatTriangle,
} from '../../../../../core/geometry/faceted/faceted-emitter';
import { type FacetedPoint } from '../../../../../core/geometry/faceted/facet-orientation';
import {
  type FacetedColor,
  StaticFacetedMeshSink,
} from '../../../../../core/geometry/faceted/static-faceted-mesh-sink';

const HANDLE_SEGMENTS = 6;
const HANDLE_RINGS = Object.freeze([
  Object.freeze({ y: 0.12, centerX: 0, centerZ: 0, radiusX: 0.115, radiusZ: 0.1, twist: 0.04 }),
  Object.freeze({ y: -0.88, centerX: 0.025, centerZ: -0.016, radiusX: 0.102, radiusZ: 0.094, twist: -0.03 }),
  Object.freeze({ y: -1.92, centerX: -0.018, centerZ: 0.019, radiusX: 0.092, radiusZ: 0.087, twist: 0.025 }),
  Object.freeze({ y: -3.05, centerX: 0.022, centerZ: -0.012, radiusX: 0.118, radiusZ: 0.102, twist: -0.045 }),
]);

const PALETTE = Object.freeze({
  woodDark: color(0.16, 0.075, 0.03),
  wood: color(0.34, 0.17, 0.065),
  woodLight: color(0.51, 0.29, 0.12),
  ironDark: color(0.07, 0.085, 0.09),
  iron: color(0.18, 0.21, 0.22),
  ironLight: color(0.34, 0.38, 0.38),
  inlay: color(0.85, 0.42, 0.08),
} satisfies Readonly<Record<string, Readonly<FacetedColor>>>);

/** 编译变截面木柄、偏心楔形锤头与破损棱角组成的程序化大锤。 */
export function createSledgehammerGeometry() {
  const sink = new StaticFacetedMeshSink();
  appendHandle(sink);
  appendHead(sink);
  appendGripInlay(sink);
  return sink.build();
}

/** 木柄使用低段数、错心和轻微扭转的多圈截面，避免规则圆柱轮廓。 */
function appendHandle(sink: StaticFacetedMeshSink): void {
  for (let ring = 0; ring < HANDLE_RINGS.length - 1; ring++) {
    for (let segment = 0; segment < HANDLE_SEGMENTS; segment++) {
      const next = (segment + 1) % HANDLE_SEGMENTS;
      const a = handlePoint(ring, segment);
      const b = handlePoint(ring, next);
      const c = handlePoint(ring + 1, next);
      const d = handlePoint(ring + 1, segment);
      const angle = (segment + 0.5) / HANDLE_SEGMENTS * Math.PI * 2;
      emitOrientedFlatQuad(
        sink,
        segment % 3 === 0 ? PALETTE.woodLight : segment % 2 === 0 ? PALETTE.wood : PALETTE.woodDark,
        a,
        b,
        c,
        d,
        Math.cos(angle),
        0,
        Math.sin(angle),
      );
    }
  }
}

/** 锤头由三组不等轮廓环连接，端面保留明显楔形和缺角。 */
function appendHead(sink: StaticFacetedMeshSink): void {
  const rings = Object.freeze([
    Object.freeze({ x: -1.43, scaleY: 0.68, scaleZ: 0.61, shiftY: 0.06, shiftZ: -0.035 }),
    Object.freeze({ x: -1.08, scaleY: 0.84, scaleZ: 0.76, shiftY: 0, shiftZ: 0.02 }),
    Object.freeze({ x: 0.92, scaleY: 0.78, scaleZ: 0.72, shiftY: -0.04, shiftZ: -0.025 }),
    Object.freeze({ x: 1.36, scaleY: 0.57, scaleZ: 0.52, shiftY: 0.025, shiftZ: 0.04 }),
  ]);
  const outline = Object.freeze([
    Object.freeze({ y: 0.95, z: -0.48 }),
    Object.freeze({ y: 1.09, z: 0.13 }),
    Object.freeze({ y: 0.7, z: 0.78 }),
    Object.freeze({ y: -0.18, z: 0.83 }),
    Object.freeze({ y: -0.84, z: 0.42 }),
    Object.freeze({ y: -0.91, z: -0.39 }),
    Object.freeze({ y: -0.43, z: -0.79 }),
    Object.freeze({ y: 0.38, z: -0.82 }),
  ]);
  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let side = 0; side < outline.length; side++) {
      const next = (side + 1) % outline.length;
      const a = headPoint(rings, outline, ring, side);
      const b = headPoint(rings, outline, ring + 1, side);
      const c = headPoint(rings, outline, ring + 1, next);
      const d = headPoint(rings, outline, ring, next);
      const middle = requirePoint(outline, side);
      emitOrientedFlatQuad(
        sink,
        (ring + side) % 3 === 0 ? PALETTE.ironLight : (ring + side) % 2 === 0
          ? PALETTE.iron : PALETTE.ironDark,
        a,
        b,
        c,
        d,
        0,
        middle.y,
        middle.z,
      );
    }
  }
  appendHeadCap(sink, rings, outline, 0, -1);
  appendHeadCap(sink, rings, outline, rings.length - 1, 1);
}

function appendHeadCap(
  sink: StaticFacetedMeshSink,
  rings: readonly Readonly<{ x: number; scaleY: number; scaleZ: number; shiftY: number; shiftZ: number }>[],
  outline: readonly Readonly<{ y: number; z: number }>[],
  ring: number,
  outwardX: -1 | 1,
): void {
  const profile = requirePoint(rings, ring);
  const center = point(profile.x, -3.08 + profile.shiftY, profile.shiftZ);
  for (let side = 0; side < outline.length; side++) {
    const next = (side + 1) % outline.length;
    emitOrientedFlatTriangle(
      sink,
      side % 2 === 0 ? PALETTE.iron : PALETTE.ironDark,
      center,
      headPoint(rings, outline, ring, side),
      headPoint(rings, outline, ring, next),
      outwardX,
      0,
      0,
    );
  }
}

/** 握持端使用不对称铜色三角嵌片表达大锤专属识别。 */
function appendGripInlay(sink: StaticFacetedMeshSink): void {
  emitOrientedFlatTriangle(
    sink,
    PALETTE.inlay,
    point(-0.092, -0.08, 0.082),
    point(0.086, -0.18, 0.087),
    point(-0.038, -0.49, 0.092),
    0,
    0,
    1,
  );
}

function handlePoint(ringIndex: number, segment: number): Readonly<FacetedPoint> {
  const ring = requirePoint(HANDLE_RINGS, ringIndex);
  const angle = segment / HANDLE_SEGMENTS * Math.PI * 2 + ring.twist;
  const variation = 1 + (((segment * 5 + ringIndex * 3) % 4) - 1.5) * 0.025;
  return point(
    ring.centerX + Math.cos(angle) * ring.radiusX * variation,
    ring.y,
    ring.centerZ + Math.sin(angle) * ring.radiusZ * variation,
  );
}

function headPoint(
  rings: readonly Readonly<{ x: number; scaleY: number; scaleZ: number; shiftY: number; shiftZ: number }>[],
  outline: readonly Readonly<{ y: number; z: number }>[],
  ringIndex: number,
  side: number,
): Readonly<FacetedPoint> {
  const ring = requirePoint(rings, ringIndex);
  const source = requirePoint(outline, side);
  return point(
    ring.x,
    -3.08 + ring.shiftY + source.y * ring.scaleY,
    ring.shiftZ + source.z * ring.scaleZ,
  );
}

function point(x: number, y: number, z: number): Readonly<FacetedPoint> {
  return Object.freeze({ x, y, z });
}

function color(red: number, green: number, blue: number): Readonly<FacetedColor> {
  return Object.freeze({ red, green, blue, alpha: 1 });
}

function requirePoint<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) {
    throw new Error('大锤程序轮廓索引越界。');
  }
  return value;
}

/** 模块级复用的大锤固定拓扑。 */
export const SLEDGEHAMMER_GEOMETRY = createSledgehammerGeometry();
