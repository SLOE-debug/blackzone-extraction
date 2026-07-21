import {
  emitOrientedFlatQuad,
  emitOrientedFlatTriangle,
} from '../../../../../core/geometry/faceted/faceted-emitter';
import { type FacetedPoint } from '../../../../../core/geometry/faceted/facet-orientation';
import {
  type FacetedColor,
  StaticFacetedMeshSink,
} from '../../../../../core/geometry/faceted/static-faceted-mesh-sink';
import {
  appendExtrudedFacetedSilhouette,
  type FacetedSilhouettePoint,
} from '../../../../../core/geometry/faceted/faceted-extruded-silhouette';
import {
  emitSampledRadialTopologyWithMeta,
  sampleRadialTopology,
} from '../../../../../core/geometry/radial/radial-emitter';
import { type RadialRingSource } from '../../../../../core/geometry/radial/radial-ring-source';
import {
  compileRadialTopologyPlan,
  RadialDegeneratePolicy,
  RadialTopologyPassKind,
  RadialTriangleOrder,
  RadialWinding,
} from '../../../../../core/geometry/radial/radial-topology-plan';
import {
  createRadialWorkspace,
  type RadialPositionArray,
} from '../../../../../core/geometry/radial/radial-workspace';

interface ShotgunTubeRing {
  readonly x: number;
  readonly centerY: number;
  readonly radius: number;
  readonly rotation: number;
}

interface ShotgunTubeSampleContext {
  readonly rings: readonly Readonly<ShotgunTubeRing>[];
}

const TUBE_SEGMENT_COUNT = 7;

const PALETTE = Object.freeze({
  steelDark: Object.freeze({ red: 0.055, green: 0.065, blue: 0.07, alpha: 1 }),
  steel: Object.freeze({ red: 0.16, green: 0.18, blue: 0.185, alpha: 1 }),
  steelLight: Object.freeze({ red: 0.31, green: 0.34, blue: 0.34, alpha: 1 }),
  woodDark: Object.freeze({ red: 0.12, green: 0.055, blue: 0.026, alpha: 1 }),
  wood: Object.freeze({ red: 0.34, green: 0.16, blue: 0.065, alpha: 1 }),
  woodLight: Object.freeze({ red: 0.5, green: 0.27, blue: 0.105, alpha: 1 }),
  bore: Object.freeze({ red: 0.012, green: 0.014, blue: 0.016, alpha: 1 }),
  rare: Object.freeze({ red: 0.08, green: 0.42, blue: 0.88, alpha: 1 }),
} satisfies Readonly<Record<string, Readonly<FacetedColor>>>);

const RECEIVER = Object.freeze([
  Object.freeze({ x: -0.78, y: 0.31 }),
  Object.freeze({ x: -0.48, y: 0.4 }),
  Object.freeze({ x: 0.58, y: 0.38 }),
  Object.freeze({ x: 0.76, y: 0.2 }),
  Object.freeze({ x: 0.62, y: -0.27 }),
  Object.freeze({ x: -0.55, y: -0.32 }),
  Object.freeze({ x: -0.84, y: -0.11 }),
] satisfies readonly FacetedSilhouettePoint[]);

const STOCK = Object.freeze([
  Object.freeze({ x: -2.52, y: 0.21 }),
  Object.freeze({ x: -2.29, y: 0.48 }),
  Object.freeze({ x: -1.58, y: 0.45 }),
  Object.freeze({ x: -0.65, y: 0.16 }),
  Object.freeze({ x: -0.58, y: -0.14 }),
  Object.freeze({ x: -1.18, y: -0.32 }),
  Object.freeze({ x: -2.31, y: -0.35 }),
  Object.freeze({ x: -2.58, y: -0.14 }),
] satisfies readonly FacetedSilhouettePoint[]);

const GRIP = Object.freeze([
  Object.freeze({ x: -0.72, y: -0.09 }),
  Object.freeze({ x: -0.23, y: -0.14 }),
  Object.freeze({ x: -0.4, y: -0.78 }),
  Object.freeze({ x: -0.67, y: -0.91 }),
  Object.freeze({ x: -0.92, y: -0.71 }),
] satisfies readonly FacetedSilhouettePoint[]);

const FORE_END = Object.freeze([
  Object.freeze({ x: 0.72, y: -0.08 }),
  Object.freeze({ x: 1.72, y: -0.1 }),
  Object.freeze({ x: 1.86, y: -0.28 }),
  Object.freeze({ x: 1.67, y: -0.49 }),
  Object.freeze({ x: 0.79, y: -0.47 }),
  Object.freeze({ x: 0.61, y: -0.28 }),
] satisfies readonly FacetedSilhouettePoint[]);

const BARREL_RINGS = Object.freeze([
  ring(0.5, 0.28, 0.13, 0.02),
  ring(1.12, 0.285, 0.122, 0.07),
  ring(1.88, 0.276, 0.116, 0.03),
  ring(2.48, 0.282, 0.11, 0.09),
  ring(2.82, 0.278, 0.124, 0.04),
]);

const MAGAZINE_RINGS = Object.freeze([
  ring(0.48, -0.13, 0.108, 0.05),
  ring(1.05, -0.145, 0.102, 0.1),
  ring(1.72, -0.14, 0.096, 0.02),
  ring(2.3, -0.125, 0.09, 0.08),
]);

/** 编译带不规则木托、分面机匣、变截面枪管和真实膛孔的泵动霰弹枪。 */
export function createPumpShotgunGeometry() {
  const sink = new StaticFacetedMeshSink();
  appendExtrudedFacetedSilhouette(
    sink, STOCK, 0.205, 0.19, PALETTE.wood, PALETTE.woodDark, PALETTE.woodLight,
  );
  appendExtrudedFacetedSilhouette(
    sink, GRIP, 0.195, 0.178, PALETTE.wood, PALETTE.woodDark, PALETTE.woodLight,
  );
  appendExtrudedFacetedSilhouette(
    sink, RECEIVER, 0.235, 0.218, PALETTE.steel, PALETTE.steelDark, PALETTE.steelLight,
  );
  appendIrregularTube(sink, BARREL_RINGS, PALETTE.steel, PALETTE.steelLight);
  appendIrregularTube(sink, MAGAZINE_RINGS, PALETTE.steelDark, PALETTE.steel);
  appendMagazineCap(sink);
  appendExtrudedFacetedSilhouette(
    sink, FORE_END, 0.285, 0.268, PALETTE.wood, PALETTE.woodDark, PALETTE.woodLight,
  );
  appendTriggerGuard(sink);
  appendMuzzleBore(sink);
  appendReceiverDetails(sink);
  appendTopSight(sink);
  appendRareInlay(sink);
  return sink.build();
}

/** 枪管与弹仓均使用低段数变截面管体，环心和截面角度保持确定性错位。 */
function appendIrregularTube(
  sink: StaticFacetedMeshSink,
  rings: readonly Readonly<ShotgunTubeRing>[],
  baseColor: Readonly<FacetedColor>,
  accentColor: Readonly<FacetedColor>,
): void {
  const plan = compileRadialTopologyPlan({
    ringCount: rings.length,
    segmentCount: TUBE_SEGMENT_COUNT,
    centerCount: 0,
    degeneratePolicy: RadialDegeneratePolicy.Reject,
    passes: Object.freeze([
      Object.freeze({
        kind: RadialTopologyPassKind.SideBands,
        firstRing: 0,
        lastRing: rings.length - 1,
        winding: RadialWinding.Reverse,
        triangleOrder: RadialTriangleOrder.PrimaryFirst,
      }),
    ]),
  });
  const workspace = createRadialWorkspace(plan);
  sampleRadialTopology(plan, SHOTGUN_TUBE_SOURCE, { rings }, workspace);
  const trianglesPerBand = TUBE_SEGMENT_COUNT * 2;
  emitSampledRadialTopologyWithMeta(
    plan,
    workspace,
    sink,
    (triangleIndex) => {
      const ringIndex = Math.floor(triangleIndex / trianglesPerBand);
      const segment = Math.floor((triangleIndex % trianglesPerBand) / 2);
      return (segment + ringIndex) % 3 === 0 ? accentColor : baseColor;
    },
  );
}

/** 枪械领域只提供各环中心、错角和非均匀半径采样。 */
const SHOTGUN_TUBE_SOURCE: RadialRingSource<ShotgunTubeSampleContext> = Object.freeze({
  sampleRing(context, ringIndex, segment, output, outputOffset): void {
    const point = tubePoint(requireRing(context.rings, ringIndex), ringIndex, segment, 1);
    writeRadialPoint(output, outputOffset, point);
  },
  sampleCenter(): void {
    throw new Error('泵动霰弹枪开放管体不应请求端盖中心。');
  },
});

/** 枪口以前环和内膛形成真实通孔，不使用平面贴色模拟。 */
function appendMuzzleBore(sink: StaticFacetedMeshSink): void {
  const muzzle = requireRing(BARREL_RINGS, BARREL_RINGS.length - 1);
  const tunnel = ring(2.57, muzzle.centerY, 0.068, muzzle.rotation);
  for (let segment = 0; segment < TUBE_SEGMENT_COUNT; segment++) {
    const next = (segment + 1) % TUBE_SEGMENT_COUNT;
    const outerCurrent = tubePoint(muzzle, BARREL_RINGS.length - 1, segment, 1.04);
    const outerNext = tubePoint(muzzle, BARREL_RINGS.length - 1, next, 1.04);
    const innerCurrent = tubePoint(muzzle, BARREL_RINGS.length - 1, segment, 0.55);
    const innerNext = tubePoint(muzzle, BARREL_RINGS.length - 1, next, 0.55);
    const tunnelCurrent = tubePoint(tunnel, BARREL_RINGS.length, segment, 1);
    const tunnelNext = tubePoint(tunnel, BARREL_RINGS.length, next, 1);
    emitOrientedFlatQuad(
      sink,
      segment % 2 === 0 ? PALETTE.steelLight : PALETTE.steel,
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

function appendMagazineCap(sink: StaticFacetedMeshSink): void {
  const cap = requireRing(MAGAZINE_RINGS, MAGAZINE_RINGS.length - 1);
  const center = point3(cap.x + 0.006, cap.centerY, 0);
  for (let segment = 0; segment < TUBE_SEGMENT_COUNT; segment++) {
    emitOrientedFlatTriangle(
      sink,
      segment % 2 === 0 ? PALETTE.steel : PALETTE.steelDark,
      center,
      tubePoint(cap, MAGAZINE_RINGS.length - 1, segment, 1),
      tubePoint(cap, MAGAZINE_RINGS.length - 1, (segment + 1) % TUBE_SEGMENT_COUNT, 1),
      1,
      0,
      0,
    );
  }
}

/** 六段护圈保留内侧空腔，让扳机区域具有可读负形。 */
function appendTriggerGuard(sink: StaticFacetedMeshSink): void {
  const outer = Object.freeze([
    Object.freeze({ x: -0.36, y: -0.25 }),
    Object.freeze({ x: 0.3, y: -0.25 }),
    Object.freeze({ x: 0.45, y: -0.43 }),
    Object.freeze({ x: 0.23, y: -0.65 }),
    Object.freeze({ x: -0.28, y: -0.62 }),
    Object.freeze({ x: -0.48, y: -0.45 }),
  ] satisfies readonly FacetedSilhouettePoint[]);
  const inner = Object.freeze([
    Object.freeze({ x: -0.25, y: -0.34 }),
    Object.freeze({ x: 0.2, y: -0.34 }),
    Object.freeze({ x: 0.32, y: -0.44 }),
    Object.freeze({ x: 0.16, y: -0.54 }),
    Object.freeze({ x: -0.2, y: -0.52 }),
    Object.freeze({ x: -0.36, y: -0.43 }),
  ] satisfies readonly FacetedSilhouettePoint[]);
  for (let index = 0; index < outer.length; index++) {
    const next = (index + 1) % outer.length;
    const outerCurrent = requireSilhouettePoint(outer, index);
    const outerNext = requireSilhouettePoint(outer, next);
    const innerCurrent = requireSilhouettePoint(inner, index);
    const innerNext = requireSilhouettePoint(inner, next);
    emitOrientedFlatQuad(
      sink,
      PALETTE.steelDark,
      point3(outerCurrent.x, outerCurrent.y, 0.225),
      point3(outerNext.x, outerNext.y, 0.225),
      point3(innerNext.x, innerNext.y, 0.225),
      point3(innerCurrent.x, innerCurrent.y, 0.225),
      0,
      0,
      1,
    );
    emitOrientedFlatQuad(
      sink,
      PALETTE.steelDark,
      point3(innerCurrent.x, innerCurrent.y, -0.21),
      point3(innerCurrent.x, innerCurrent.y, 0.225),
      point3(innerNext.x, innerNext.y, 0.225),
      point3(innerNext.x, innerNext.y, -0.21),
      0,
      -1,
      0,
    );
  }
}

function appendReceiverDetails(sink: StaticFacetedMeshSink): void {
  emitOrientedFlatQuad(
    sink,
    PALETTE.bore,
    point3(-0.3, 0.23, 0.238),
    point3(0.34, 0.23, 0.238),
    point3(0.27, -0.02, 0.238),
    point3(-0.25, -0.04, 0.238),
    0,
    0,
    1,
  );
  emitOrientedFlatTriangle(
    sink,
    PALETTE.steelLight,
    point3(-0.02, -0.3, 0.239),
    point3(0.15, -0.31, 0.239),
    point3(0.02, -0.48, 0.239),
    0,
    0,
    1,
  );
}

function appendTopSight(sink: StaticFacetedMeshSink): void {
  appendExtrudedFacetedSilhouette(
    sink,
    Object.freeze([
      Object.freeze({ x: 2.45, y: 0.38 }),
      Object.freeze({ x: 2.57, y: 0.5 }),
      Object.freeze({ x: 2.69, y: 0.45 }),
      Object.freeze({ x: 2.73, y: 0.36 }),
    ]),
    0.045,
    0.045,
    PALETTE.steelLight,
    PALETTE.steelDark,
    PALETTE.steelDark,
  );
}

function appendRareInlay(sink: StaticFacetedMeshSink): void {
  emitOrientedFlatTriangle(
    sink,
    PALETTE.rare,
    point3(-1.95, 0.08, 0.208),
    point3(-1.58, 0.24, 0.208),
    point3(-1.55, -0.1, 0.208),
    0,
    0,
    1,
  );
}

function tubePoint(
  tubeRing: Readonly<ShotgunTubeRing>,
  ringIndex: number,
  segment: number,
  radiusScale: number,
): Readonly<FacetedPoint> {
  const angle = segment / TUBE_SEGMENT_COUNT * Math.PI * 2 + tubeRing.rotation;
  const variation = 1 + (((segment * 5 + ringIndex * 3) % 5) - 2) * 0.014;
  const radius = tubeRing.radius * variation * radiusScale;
  return point3(
    tubeRing.x,
    tubeRing.centerY + Math.cos(angle) * radius,
    Math.sin(angle) * radius,
  );
}

/** 把领域采样点写入 Radial 双精度工作区。 */
function writeRadialPoint(
  output: RadialPositionArray,
  outputOffset: number,
  point: Readonly<FacetedPoint>,
): void {
  output[outputOffset] = point.x;
  output[outputOffset + 1] = point.y;
  output[outputOffset + 2] = point.z;
}

function ring(
  x: number,
  centerY: number,
  radius: number,
  rotation: number,
): Readonly<ShotgunTubeRing> {
  return Object.freeze({ x, centerY, radius, rotation });
}

function requireRing(
  rings: readonly Readonly<ShotgunTubeRing>[],
  index: number,
): Readonly<ShotgunTubeRing> {
  const value = rings[index];
  if (value === undefined) {
    throw new Error('泵动霰弹枪管体环索引越界。');
  }
  return value;
}

function requireSilhouettePoint(
  points: readonly Readonly<FacetedSilhouettePoint>[],
  index: number,
): Readonly<FacetedSilhouettePoint> {
  const value = points[index];
  if (value === undefined) {
    throw new Error('泵动霰弹枪护圈索引越界。');
  }
  return value;
}

function point3(x: number, y: number, z: number): Readonly<FacetedPoint> {
  return Object.freeze({ x, y, z });
}

/** 模块级复用的泵动霰弹枪固定程序化拓扑。 */
export const PUMP_SHOTGUN_GEOMETRY = createPumpShotgunGeometry();
