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
  receiver: color(0.13, 0.15, 0.15),
  receiverLight: color(0.25, 0.28, 0.27),
  dark: color(0.025, 0.032, 0.032),
  polymer: color(0.09, 0.11, 0.105),
  metal: color(0.2, 0.23, 0.22),
  bore: color(0.005, 0.007, 0.006),
  rare: color(0.075, 0.43, 0.9),
  sight: color(0.7, 0.13, 0.08),
});

const RECEIVER = points([
  [-0.68, 0.35], [-0.46, 0.56], [0.58, 0.55], [0.82, 0.36],
  [0.72, -0.22], [0.31, -0.38], [-0.5, -0.24], [-0.79, 0.03],
]);
const HANDGUARD = points([
  [0.61, 0.39], [1.76, 0.38], [1.95, 0.19], [1.83, -0.22],
  [1.55, -0.37], [0.66, -0.31], [0.51, -0.04],
]);
const STOCK_BODY = points([
  [-2.35, 0.27], [-2.13, 0.58], [-1.34, 0.46], [-0.78, 0.19],
  [-0.87, -0.09], [-1.45, -0.12], [-2.15, -0.26], [-2.43, -0.06],
]);
const BUFFER_TUBE = points([
  [-1.55, 0.29], [-0.63, 0.32], [-0.61, 0.12], [-1.6, 0.08],
]);
const GRIP = points([
  [-0.67, -0.18], [-0.2, -0.21], [-0.31, -0.98],
  [-0.59, -1.11], [-0.86, -0.94], [-0.91, -0.43],
]);
const MAGAZINE = points([
  [0.04, -0.29], [0.51, -0.31], [0.58, -1.16],
  [0.29, -1.35], [-0.14, -1.2], [-0.21, -0.54],
]);

const BARREL_RINGS = Object.freeze([
  ring(1.67, 0.19, 0, 0.105, 0.095, 0.02),
  ring(2.12, 0.2, 0.004, 0.098, 0.09, 0.075),
  ring(2.68, 0.196, -0.005, 0.09, 0.082, 0.025),
  ring(2.96, 0.202, 0.002, 0.122, 0.112, 0.11),
]);

/** 创建具有伸缩托、分段护木、弧形弹匣和真实枪口的 M4A1。 */
export function createM4A1Geometry() {
  const sink = new StaticFacetedMeshSink();
  appendPart(sink, BUFFER_TUBE, 0.12, 0.115, PALETTE.metal);
  appendPart(sink, STOCK_BODY, 0.205, 0.19, PALETTE.polymer);
  appendPart(sink, GRIP, 0.195, 0.18, PALETTE.polymer);
  appendPart(sink, MAGAZINE, 0.205, 0.19, PALETTE.receiver);
  appendPart(sink, RECEIVER, 0.24, 0.225, PALETTE.receiver);
  appendPart(sink, HANDGUARD, 0.265, 0.25, PALETTE.polymer);
  appendIrregularFirearmTube(
    sink,
    BARREL_RINGS,
    7,
    PALETTE.metal,
    PALETTE.receiverLight,
  );
  appendFacetedMuzzleBore(
    sink,
    requireLastRing(BARREL_RINGS),
    7,
    0.47,
    0.2,
    PALETTE.metal,
    PALETTE.bore,
  );
  appendFacetedTopRail(
    sink,
    -0.48,
    1.82,
    0.51,
    13,
    0.17,
    PALETTE.dark,
    PALETTE.receiverLight,
  );
  appendFacetedTriggerGuard(
    sink,
    points([[-0.37, -0.22], [-0.06, -0.49], [0.3, -0.42], [0.38, -0.24]]),
    0.085,
    0.215,
    0.2,
    PALETTE.dark,
    PALETTE.receiverLight,
  );
  appendM4Details(sink);
  return sink.build();
}

/** 增加机械瞄具、弹窗、护木散热槽和蓝色制式识别条。 */
function appendM4Details(sink: StaticFacetedMeshSink): void {
  appendFacetedSurfacePanel(
    sink,
    points([[-0.31, 0.31], [0.4, 0.34], [0.52, 0.09], [-0.16, 0.03]]),
    0.243,
    PALETTE.dark,
  );
  appendFacetedSurfacePanel(
    sink,
    points([[0.76, 0.23], [1.61, 0.22], [1.5, 0.05], [0.83, 0.02]]),
    0.268,
    PALETTE.receiverLight,
  );
  appendFacetedSurfacePanel(
    sink,
    points([[-2.12, 0.15], [-1.52, 0.29], [-1.49, 0.12], [-2.05, -0.04]]),
    0.208,
    PALETTE.rare,
  );
  appendPart(
    sink,
    points([[-0.38, 0.65], [-0.25, 0.91], [-0.03, 0.9], [0.06, 0.64]]),
    0.105,
    0.098,
    PALETTE.dark,
  );
  appendPart(
    sink,
    points([[1.66, 0.53], [1.75, 0.82], [1.93, 0.8], [1.98, 0.49]]),
    0.095,
    0.09,
    PALETTE.dark,
  );
  appendFacetedSurfacePanel(
    sink,
    points([[1.78, 0.74], [1.86, 0.75], [1.88, 0.67], [1.8, 0.66]]),
    0.098,
    PALETTE.sight,
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
    edgeColor: PALETTE.dark,
    accentColor: PALETTE.receiverLight,
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
    throw new Error('M4A1 枪口截面不存在。');
  }
  return value;
}

function color(red: number, green: number, blue: number): Readonly<FacetedColor> {
  return Object.freeze({ red, green, blue, alpha: 1 });
}

/** 模块级复用的 M4A1 固定程序化拓扑。 */
export const M4A1_GEOMETRY = createM4A1Geometry();
