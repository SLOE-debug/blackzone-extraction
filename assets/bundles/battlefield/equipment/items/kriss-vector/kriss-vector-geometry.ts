import { type FacetedSilhouettePoint } from '../../../../../core/geometry/faceted/faceted-extruded-silhouette';
import {
  type FacetedColor,
  StaticFacetedMeshSink,
} from '../../../../../core/geometry/faceted/static-faceted-mesh-sink';
import {
  appendFacetedFirearmSilhouette,
  appendFacetedMuzzleBore,
  appendFacetedSurfacePanel,
  appendFacetedTopRail,
  appendFacetedTriggerGuard,
  appendIrregularFirearmTube,
  type FacetedFirearmTubeRing,
} from '../../geometry/faceted-firearm-builder';

const PALETTE = Object.freeze({
  graphite: color(0.075, 0.085, 0.1),
  graphiteLight: color(0.16, 0.18, 0.2),
  graphiteDark: color(0.025, 0.03, 0.04),
  polymer: color(0.19, 0.21, 0.22),
  bore: color(0.006, 0.008, 0.012),
  legendary: color(0.63, 0.16, 0.92),
  energy: color(0.08, 0.78, 0.86),
});

const UPPER_RECEIVER = points([
  [-0.86, 0.58], [-0.62, 0.79], [0.72, 0.76], [1.02, 0.58],
  [0.93, 0.16], [0.58, -0.02], [-0.63, 0.03], [-0.94, 0.25],
]);
const LOWER_RECEIVER = points([
  [-0.55, 0.08], [0.84, 0.13], [0.94, -0.08], [0.59, -0.74],
  [0.13, -0.92], [-0.16, -0.61], [-0.72, -0.43], [-0.82, -0.12],
]);
const GRIP = points([
  [-0.79, -0.18], [-0.31, -0.19], [-0.42, -1.18],
  [-0.72, -1.31], [-0.99, -1.12], [-1.03, -0.49],
]);
const MAGAZINE = points([
  [-0.36, -0.56], [0.12, -0.6], [0.23, -1.66],
  [-0.03, -1.86], [-0.39, -1.72], [-0.51, -0.92],
]);
const STOCK_TOP = points([
  [-2.12, 0.67], [-1.92, 0.89], [-0.63, 0.75],
  [-0.58, 0.56], [-1.69, 0.53], [-2.11, 0.37],
]);
const STOCK_BOTTOM = points([
  [-2.11, 0.37], [-1.69, 0.53], [-0.84, 0.12],
  [-0.98, -0.11], [-1.79, 0.12], [-2.2, 0.08],
]);

const BARREL_RINGS = Object.freeze([
  ring(0.76, 0.47, 0, 0.135, 0.123, 0.03),
  ring(1.2, 0.49, 0.008, 0.128, 0.118, 0.1),
  ring(1.72, 0.485, -0.004, 0.12, 0.108, 0.055),
  ring(2.1, 0.493, 0.006, 0.145, 0.132, 0.13),
]);

/** 创建轮廓紧凑、低枪管轴且拥有可读导轨与折叠托的 KRISS Vector。 */
export function createKrissVectorGeometry() {
  const sink = new StaticFacetedMeshSink();
  appendPart(sink, STOCK_TOP, 0.19, 0.18, PALETTE.graphiteLight);
  appendPart(sink, STOCK_BOTTOM, 0.17, 0.16, PALETTE.graphite);
  appendPart(sink, GRIP, 0.215, 0.2, PALETTE.polymer);
  appendPart(sink, MAGAZINE, 0.175, 0.164, PALETTE.graphiteDark);
  appendPart(sink, LOWER_RECEIVER, 0.28, 0.255, PALETTE.polymer);
  appendPart(sink, UPPER_RECEIVER, 0.25, 0.235, PALETTE.graphiteLight);
  appendIrregularFirearmTube(
    sink,
    BARREL_RINGS,
    7,
    PALETTE.graphite,
    PALETTE.graphiteLight,
  );
  appendFacetedMuzzleBore(
    sink,
    requireLastRing(BARREL_RINGS),
    7,
    0.5,
    0.18,
    PALETTE.graphiteLight,
    PALETTE.bore,
  );
  appendFacetedTopRail(
    sink,
    -0.77,
    1.08,
    0.75,
    10,
    0.185,
    PALETTE.graphite,
    PALETTE.graphiteLight,
  );
  appendFacetedTriggerGuard(
    sink,
    points([[-0.47, -0.09], [-0.05, -0.28], [0.2, -0.18], [0.24, 0.02]]),
    0.09,
    0.232,
    0.217,
    PALETTE.graphiteDark,
    PALETTE.graphiteLight,
  );
  appendVectorDetails(sink);
  return sink.build();
}

/** 用独立表面分面强调 Vector 的斜向导能槽、弹匣井和稀有度镶条。 */
function appendVectorDetails(sink: StaticFacetedMeshSink): void {
  appendFacetedSurfacePanel(
    sink,
    points([[-0.23, 0.5], [0.61, 0.5], [0.71, 0.3], [-0.07, 0.25]]),
    0.283,
    PALETTE.graphiteDark,
  );
  appendFacetedSurfacePanel(
    sink,
    points([[0.24, 0.02], [0.74, 0.11], [0.51, -0.53], [0.11, -0.73]]),
    0.284,
    PALETTE.legendary,
  );
  appendFacetedSurfacePanel(
    sink,
    points([[-0.5, 0.7], [-0.12, 0.72], [-0.2, 0.61], [-0.55, 0.59]]),
    0.254,
    PALETTE.energy,
  );
  appendPart(
    sink,
    points([[-0.63, 0.88], [-0.48, 1.08], [-0.24, 1.05], [-0.16, 0.85]]),
    0.12,
    0.115,
    PALETTE.graphiteDark,
  );
  appendPart(
    sink,
    points([[0.73, 0.85], [0.83, 1.04], [1.02, 1.01], [1.07, 0.82]]),
    0.105,
    0.1,
    PALETTE.graphiteDark,
  );
}

function appendPart(
  sink: StaticFacetedMeshSink,
  outline: readonly Readonly<FacetedSilhouettePoint>[],
  frontDepth: number,
  backDepth: number,
  faceColor: Readonly<FacetedColor>,
): void {
  appendFacetedFirearmSilhouette(sink, {
    points: outline,
    frontDepth,
    backDepth,
    faceColor,
    edgeColor: PALETTE.graphiteDark,
    accentColor: PALETTE.graphiteLight,
  });
}

function points(values: readonly (readonly [number, number])[]):
readonly Readonly<FacetedSilhouettePoint>[] {
  return Object.freeze(values.map(([x, y]) => Object.freeze({ x, y })));
}

function ring(
  x: number,
  centerY: number,
  centerZ: number,
  radiusY: number,
  radiusZ: number,
  rotation: number,
): Readonly<FacetedFirearmTubeRing> {
  return Object.freeze({ x, centerY, centerZ, radiusY, radiusZ, rotation });
}

function requireLastRing(
  rings: readonly Readonly<FacetedFirearmTubeRing>[],
): Readonly<FacetedFirearmTubeRing> {
  const value = rings[rings.length - 1];
  if (value === undefined) {
    throw new Error('KRISS Vector 枪口截面不存在。');
  }
  return value;
}

function color(red: number, green: number, blue: number): Readonly<FacetedColor> {
  return Object.freeze({ red, green, blue, alpha: 1 });
}

/** 模块级复用的 KRISS Vector 固定程序化拓扑。 */
export const KRISS_VECTOR_GEOMETRY = createKrissVectorGeometry();
