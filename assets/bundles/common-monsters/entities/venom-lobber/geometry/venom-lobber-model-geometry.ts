import {
  emitOrientedFlatQuad,
  emitOrientedFlatTriangle,
} from '../../../../../core/geometry/faceted/faceted-emitter';
import { type FacetedPoint } from '../../../../../core/geometry/faceted/facet-orientation';
import {
  type FacetedColor,
  StaticFacetedMeshSink,
} from '../../../../../core/geometry/faceted/static-faceted-mesh-sink';
import { type StaticSurfaceBufferGeometry } from '../../../../../core/geometry/buffer-geometry';

const TAU = Math.PI * 2;
const BODY_SEGMENTS = 8;
const BODY_RINGS = 4;
const LIMB_SEGMENTS = 6;
const TAIL_BONE_COUNT = 8;

const PALETTE = Object.freeze({
  shell: color(0.16, 0.25, 0.12),
  shellLight: color(0.29, 0.42, 0.18),
  shellDark: color(0.055, 0.09, 0.045),
  belly: color(0.21, 0.18, 0.075),
  joint: color(0.1, 0.14, 0.07),
  venom: color(0.18, 0.82, 0.11),
  venomLight: color(0.52, 1, 0.18),
  eye: color(0.92, 0.12, 0.035),
  stinger: color(0.09, 0.16, 0.055),
});

interface PathRing {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly lateralRadius: number;
  readonly verticalRadius: number;
  readonly twist: number;
}

/** Venom Lobber 静态源模型以及渲染动画所需的顶点语义权重。 */
export interface VenomLobberModelGeometry {
  readonly geometry: StaticSurfaceBufferGeometry;
  readonly tailWeights: Float32Array;
  readonly tailBones: Uint8Array;
  readonly venomWeights: Float32Array;
  readonly legGroups: Uint8Array;
  readonly strikeWeights: Float32Array;
  readonly tailBoneCount: number;
}

/**
 * 编译具有六足、分层甲壳、双毒囊、卷曲尾刺和真实硬分面的领域模型。
 *
 * 所有不规则参数均由固定控制点和索引扰动决定，不使用运行时随机数。
 */
export function createVenomLobberModelGeometry(): VenomLobberModelGeometry {
  const sink = new StaticFacetedMeshSink();
  appendIrregularEllipsoid(sink, -0.7, 0, 2.25, 3.25, 2.15, 1.75, 2, PALETTE.shell);
  appendIrregularEllipsoid(sink, 2.05, -0.08, 2.15, 2.25, 1.78, 1.45, 5, PALETTE.shellLight);
  appendIrregularEllipsoid(sink, 4.02, 0.04, 2.28, 1.42, 1.28, 1.12, 7, PALETTE.shell);
  appendBellyPlate(sink);
  appendArmorRidges(sink);
  const legStart = sink.vertexCount;
  appendLegs(sink);
  const legEnd = sink.vertexCount;
  appendEyesAndMandibles(sink);

  const tailStart = sink.vertexCount;
  appendTail(sink);
  const tailEnd = sink.vertexCount;
  const venomStart = sink.vertexCount;
  appendVenomSacs(sink);
  appendStinger(sink);
  const venomEnd = sink.vertexCount;

  const geometry = sink.build();
  const tailWeights = new Float32Array(geometry.vertexCount);
  const tailBones = new Uint8Array(geometry.vertexCount);
  const venomWeights = new Float32Array(geometry.vertexCount);
  const legGroups = new Uint8Array(geometry.vertexCount);
  const strikeWeights = new Float32Array(geometry.vertexCount);
  for (let vertex = tailStart; vertex < tailEnd; vertex++) {
    const x = geometry.positions[vertex * 3] ?? -2.2;
    const weight = Math.max(0, Math.min(1, (-x - 1.8) / 5.2));
    const bone = Math.round(weight * (TAIL_BONE_COUNT - 1));
    tailBones[vertex] = bone;
    tailWeights[vertex] = bone / (TAIL_BONE_COUNT - 1);
  }
  for (let vertex = venomStart; vertex < venomEnd; vertex++) {
    venomWeights[vertex] = 1;
    const bone = Math.round(0.72 * (TAIL_BONE_COUNT - 1));
    tailBones[vertex] = bone;
    tailWeights[vertex] = bone / (TAIL_BONE_COUNT - 1);
  }
  for (let vertex = legStart; vertex < legEnd; vertex++) {
    const positionOffset = vertex * 3;
    const x = geometry.positions[positionOffset] ?? 0;
    const y = geometry.positions[positionOffset + 1] ?? 0;
    const longitudinalGroup = x > 1.45 ? 0 : x > -1.2 ? 1 : 2;
    legGroups[vertex] = 1 + longitudinalGroup + (y < 0 ? 3 : 0);
  }
  for (let vertex = 0; vertex < geometry.vertexCount; vertex++) {
    const x = geometry.positions[vertex * 3] ?? 0;
    strikeWeights[vertex] = Math.max(0, Math.min(1, (x - 1.15) / 3.8));
  }
  return Object.freeze({
    geometry,
    tailWeights,
    tailBones,
    venomWeights,
    legGroups,
    strikeWeights,
    tailBoneCount: TAIL_BONE_COUNT,
  });
}

function appendLegs(sink: StaticFacetedMeshSink): void {
  const leftPaths = Object.freeze([
    path([[2.7, 1.1, 1.8, 0.45], [3.1, 2.7, 1.35, 0.38], [2.45, 4.35, 0.55, 0.3], [2.8, 5.15, 0.16, 0.2]]),
    path([[0.75, 1.55, 1.65, 0.52], [0.65, 3.25, 1.18, 0.42], [-0.15, 5.0, 0.48, 0.31], [0.12, 5.72, 0.14, 0.2]]),
    path([[-1.55, 1.45, 1.72, 0.5], [-2.25, 3.0, 1.24, 0.41], [-3.5, 4.48, 0.44, 0.3], [-3.55, 5.25, 0.13, 0.19]]),
  ]);
  const rightPaths = Object.freeze([
    path([[2.85, -1.02, 1.75, 0.44], [3.38, -2.65, 1.3, 0.37], [2.9, -4.42, 0.5, 0.3], [3.16, -5.18, 0.15, 0.19]]),
    path([[0.55, -1.52, 1.62, 0.51], [0.2, -3.3, 1.12, 0.42], [-0.82, -4.9, 0.45, 0.31], [-0.72, -5.76, 0.14, 0.2]]),
    path([[-1.7, -1.34, 1.7, 0.49], [-2.55, -2.82, 1.18, 0.4], [-3.95, -4.12, 0.42, 0.29], [-4.08, -4.98, 0.13, 0.18]]),
  ]);
  let pathIndex = 0;
  for (const rings of leftPaths) {
    appendIrregularPathTube(sink, rings, LIMB_SEGMENTS, pathIndex++, PALETTE.joint, PALETTE.shellLight);
  }
  for (const rings of rightPaths) {
    appendIrregularPathTube(sink, rings, LIMB_SEGMENTS, pathIndex++, PALETTE.joint, PALETTE.shell);
  }
}

function appendTail(sink: StaticFacetedMeshSink): void {
  appendIrregularPathTube(
    sink,
    Object.freeze([
      ring(-2.45, 0.05, 2.75, 1.06, 0.92, 0.02),
      ring(-3.75, -0.16, 3.0, 0.9, 0.82, 0.11),
      ring(-4.95, 0.18, 3.7, 0.73, 0.68, 0.04),
      ring(-5.95, 0.72, 4.75, 0.59, 0.56, 0.15),
      ring(-6.4, 1.42, 5.95, 0.45, 0.43, 0.08),
      ring(-6.12, 2.05, 7.0, 0.34, 0.32, 0.19),
      ring(-5.35, 2.35, 7.62, 0.23, 0.21, 0.1),
    ]),
    7,
    13,
    PALETTE.shellDark,
    PALETTE.shellLight,
  );
}

function appendVenomSacs(sink: StaticFacetedMeshSink): void {
  appendIrregularEllipsoid(sink, -3.72, 0.82, 3.92, 1.05, 0.72, 0.82, 17, PALETTE.venom);
  appendIrregularEllipsoid(sink, -3.88, -0.72, 3.78, 0.94, 0.67, 0.76, 23, PALETTE.venomLight);
}

function appendStinger(sink: StaticFacetedMeshSink): void {
  const base = point(-5.34, 2.34, 7.62);
  const tip = point(-4.45, 2.5, 7.92);
  const sideA = point(-5.12, 2.02, 7.42);
  const sideB = point(-5.1, 2.62, 7.38);
  const underside = point(-5.08, 2.34, 7.16);
  emitOrientedFlatTriangle(sink, PALETTE.stinger, base, sideA, tip, 0, -1, 0.3);
  emitOrientedFlatTriangle(sink, PALETTE.venomLight, base, tip, sideB, 0, 1, 0.3);
  emitOrientedFlatTriangle(sink, PALETTE.stinger, sideA, underside, tip, 0, 0, -1);
  emitOrientedFlatTriangle(sink, PALETTE.shellLight, underside, sideB, tip, 0, 0, -1);
}

function appendEyesAndMandibles(sink: StaticFacetedMeshSink): void {
  appendIrregularEllipsoid(sink, 4.86, 0.63, 2.72, 0.28, 0.25, 0.31, 29, PALETTE.eye);
  appendIrregularEllipsoid(sink, 4.91, -0.55, 2.65, 0.25, 0.27, 0.29, 31, PALETTE.eye);
  appendIrregularPathTube(
    sink,
    path([[4.8, 0.58, 1.95, 0.22], [5.45, 0.82, 1.62, 0.17], [5.78, 0.48, 1.38, 0.08]]),
    5,
    37,
    PALETTE.shellDark,
    PALETTE.shellLight,
  );
  appendIrregularPathTube(
    sink,
    path([[4.86, -0.5, 1.9, 0.21], [5.5, -0.7, 1.56, 0.16], [5.74, -0.33, 1.34, 0.08]]),
    5,
    41,
    PALETTE.shellDark,
    PALETTE.shell,
  );
}

function appendBellyPlate(sink: StaticFacetedMeshSink): void {
  const leftRear = point(-2.5, 1.15, 1.12);
  const rightRear = point(-2.25, -1.2, 1.05);
  const leftFront = point(2.8, 0.95, 1.08);
  const rightFront = point(2.65, -1.05, 1.02);
  emitOrientedFlatQuad(
    sink,
    PALETTE.belly,
    leftRear,
    rightRear,
    rightFront,
    leftFront,
    0,
    0,
    -1,
  );
}

function appendArmorRidges(sink: StaticFacetedMeshSink): void {
  for (let index = 0; index < 5; index++) {
    const x = -2.15 + index * 1.1;
    const left = point(x - 0.42, 0, 3.55 + (index % 2) * 0.15);
    const right = point(x + 0.46, 0.04, 3.48 - (index % 2) * 0.08);
    const crest = point(x + 0.05, 0.03, 4.05 + (index % 3) * 0.12);
    emitOrientedFlatTriangle(
      sink,
      index % 2 === 0 ? PALETTE.shellLight : PALETTE.shellDark,
      left,
      right,
      crest,
      0,
      0,
      1,
    );
  }
}

function appendIrregularEllipsoid(
  sink: StaticFacetedMeshSink,
  centerX: number,
  centerY: number,
  centerZ: number,
  radiusX: number,
  radiusY: number,
  radiusZ: number,
  seed: number,
  baseColor: Readonly<FacetedColor>,
): void {
  const accentColor = baseColor === PALETTE.venom
    ? PALETTE.venomLight
    : baseColor === PALETTE.venomLight
      ? PALETTE.venom
      : baseColor === PALETTE.eye
        ? PALETTE.eye
        : PALETTE.shellLight;
  for (let ringIndex = 0; ringIndex < BODY_RINGS - 2; ringIndex++) {
    const latitudeA = -Math.PI * 0.5 + (ringIndex + 1) / BODY_RINGS * Math.PI;
    const latitudeB = -Math.PI * 0.5 + (ringIndex + 2) / BODY_RINGS * Math.PI;
    for (let segment = 0; segment < BODY_SEGMENTS; segment++) {
      const next = (segment + 1) % BODY_SEGMENTS;
      const a = ellipsoidPoint(
        centerX, centerY, centerZ, radiusX, radiusY, radiusZ, latitudeA, segment, seed,
      );
      const b = ellipsoidPoint(
        centerX, centerY, centerZ, radiusX, radiusY, radiusZ, latitudeA, next, seed,
      );
      const c = ellipsoidPoint(
        centerX, centerY, centerZ, radiusX, radiusY, radiusZ, latitudeB, next, seed,
      );
      const d = ellipsoidPoint(
        centerX, centerY, centerZ, radiusX, radiusY, radiusZ, latitudeB, segment, seed,
      );
      const expectedX = (a.x + b.x + c.x + d.x) * 0.25 - centerX;
      const expectedY = (a.y + b.y + c.y + d.y) * 0.25 - centerY;
      const expectedZ = (a.z + b.z + c.z + d.z) * 0.25 - centerZ;
      const faceColor = (segment + ringIndex + seed) % 3 === 0
        ? accentColor
        : baseColor;
      emitOrientedFlatQuad(
        sink, faceColor, a, b, c, d, expectedX, expectedY, expectedZ,
      );
    }
  }
  const bottom = point(centerX + radiusX * 0.03, centerY, centerZ - radiusZ * 0.98);
  const top = point(centerX - radiusX * 0.02, centerY, centerZ + radiusZ * 1.03);
  for (let segment = 0; segment < BODY_SEGMENTS; segment++) {
    const next = (segment + 1) % BODY_SEGMENTS;
    const lowerA = ellipsoidPoint(
      centerX, centerY, centerZ, radiusX, radiusY, radiusZ,
      -Math.PI * 0.5 + Math.PI / BODY_RINGS, segment, seed,
    );
    const lowerB = ellipsoidPoint(
      centerX, centerY, centerZ, radiusX, radiusY, radiusZ,
      -Math.PI * 0.5 + Math.PI / BODY_RINGS, next, seed,
    );
    const upperA = ellipsoidPoint(
      centerX, centerY, centerZ, radiusX, radiusY, radiusZ,
      Math.PI * 0.5 - Math.PI / BODY_RINGS, segment, seed,
    );
    const upperB = ellipsoidPoint(
      centerX, centerY, centerZ, radiusX, radiusY, radiusZ,
      Math.PI * 0.5 - Math.PI / BODY_RINGS, next, seed,
    );
    emitOrientedFlatTriangle(
      sink, PALETTE.shellDark, bottom, lowerB, lowerA, 0, 0, -1,
    );
    emitOrientedFlatTriangle(
      sink, segment % 2 === 0 ? baseColor : accentColor,
      top, upperA, upperB, 0, 0, 1,
    );
  }
}

function appendIrregularPathTube(
  sink: StaticFacetedMeshSink,
  rings: readonly Readonly<PathRing>[],
  segmentCount: number,
  seed: number,
  baseColor: Readonly<FacetedColor>,
  accentColor: Readonly<FacetedColor>,
): void {
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex++) {
    const current = requireRing(rings, ringIndex);
    const nextRing = requireRing(rings, ringIndex + 1);
    for (let segment = 0; segment < segmentCount; segment++) {
      const nextSegment = (segment + 1) % segmentCount;
      const a = pathPoint(rings, ringIndex, segment, segmentCount, seed);
      const b = pathPoint(rings, ringIndex + 1, segment, segmentCount, seed);
      const c = pathPoint(rings, ringIndex + 1, nextSegment, segmentCount, seed);
      const d = pathPoint(rings, ringIndex, nextSegment, segmentCount, seed);
      const expectedX = (a.x + b.x + c.x + d.x) * 0.25
        - (current.x + nextRing.x) * 0.5;
      const expectedY = (a.y + b.y + c.y + d.y) * 0.25
        - (current.y + nextRing.y) * 0.5;
      const expectedZ = (a.z + b.z + c.z + d.z) * 0.25
        - (current.z + nextRing.z) * 0.5;
      emitOrientedFlatQuad(
        sink,
        (segment + ringIndex + seed) % 3 === 0 ? accentColor : baseColor,
        a,
        b,
        c,
        d,
        expectedX,
        expectedY,
        expectedZ,
      );
    }
  }
  appendPathCap(sink, rings, 0, segmentCount, seed, baseColor, 1);
  appendPathCap(sink, rings, rings.length - 1, segmentCount, seed, accentColor, 1);
}

function appendPathCap(
  sink: StaticFacetedMeshSink,
  rings: readonly Readonly<PathRing>[],
  ringIndex: number,
  segmentCount: number,
  seed: number,
  colorValue: Readonly<FacetedColor>,
  direction: number,
): void {
  const current = requireRing(rings, ringIndex);
  const neighbor = requireRing(rings, ringIndex === 0 ? 1 : ringIndex - 1);
  const expectedX = (current.x - neighbor.x) * direction;
  const expectedY = (current.y - neighbor.y) * direction;
  const expectedZ = (current.z - neighbor.z) * direction;
  const center = point(current.x, current.y, current.z);
  for (let segment = 0; segment < segmentCount; segment++) {
    emitOrientedFlatTriangle(
      sink,
      colorValue,
      center,
      pathPoint(rings, ringIndex, segment, segmentCount, seed),
      pathPoint(rings, ringIndex, (segment + 1) % segmentCount, segmentCount, seed),
      expectedX,
      expectedY,
      expectedZ,
    );
  }
}

function ellipsoidPoint(
  centerX: number,
  centerY: number,
  centerZ: number,
  radiusX: number,
  radiusY: number,
  radiusZ: number,
  latitude: number,
  segment: number,
  seed: number,
): Readonly<FacetedPoint> {
  const longitude = segment / BODY_SEGMENTS * TAU + seed * 0.031;
  const variation = 1 + (((segment * 5 + seed * 3) % 7) - 3) * 0.018;
  const latitudeCosine = Math.cos(latitude);
  return point(
    centerX + Math.cos(longitude) * latitudeCosine * radiusX * variation,
    centerY + Math.sin(longitude) * latitudeCosine * radiusY / variation,
    centerZ + Math.sin(latitude) * radiusZ * (2 - variation),
  );
}

function pathPoint(
  rings: readonly Readonly<PathRing>[],
  ringIndex: number,
  segment: number,
  segmentCount: number,
  seed: number,
): Readonly<FacetedPoint> {
  const current = requireRing(rings, ringIndex);
  const previous = requireRing(rings, Math.max(0, ringIndex - 1));
  const next = requireRing(rings, Math.min(rings.length - 1, ringIndex + 1));
  const tangentX = next.x - previous.x;
  const tangentY = next.y - previous.y;
  const inverseLength = 1 / Math.max(Math.hypot(tangentX, tangentY), 0.0001);
  const lateralX = -tangentY * inverseLength;
  const lateralY = tangentX * inverseLength;
  const angle = segment / segmentCount * TAU + current.twist;
  const variation = 1 + (((segment * 3 + ringIndex * 5 + seed) % 5) - 2) * 0.022;
  const lateral = Math.cos(angle) * current.lateralRadius * variation;
  const vertical = Math.sin(angle) * current.verticalRadius / variation;
  return point(
    current.x + lateralX * lateral,
    current.y + lateralY * lateral,
    current.z + vertical,
  );
}

function path(values: readonly (readonly [number, number, number, number])[]):
readonly Readonly<PathRing>[] {
  return Object.freeze(values.map(([x, y, z, radius], index) =>
    ring(x, y, z, radius, radius * (0.82 + index % 2 * 0.08), index * 0.09)));
}

function ring(
  x: number,
  y: number,
  z: number,
  lateralRadius: number,
  verticalRadius: number,
  twist: number,
): Readonly<PathRing> {
  return Object.freeze({ x, y, z, lateralRadius, verticalRadius, twist });
}

function requireRing(
  rings: readonly Readonly<PathRing>[],
  index: number,
): Readonly<PathRing> {
  const value = rings[index];
  if (value === undefined) {
    throw new Error('Venom Lobber 变截面路径索引越界。');
  }
  return value;
}

function point(x: number, y: number, z: number): Readonly<FacetedPoint> {
  return Object.freeze({ x, y, z });
}

function color(red: number, green: number, blue: number): Readonly<FacetedColor> {
  return Object.freeze({ red, green, blue, alpha: 1 });
}

/** 模块级复用的 Venom Lobber 固定程序化模型。 */
export const VENOM_LOBBER_MODEL_GEOMETRY = createVenomLobberModelGeometry();
