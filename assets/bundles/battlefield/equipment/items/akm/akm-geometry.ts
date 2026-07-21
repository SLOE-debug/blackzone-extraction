import { type FacetedSilhouettePoint } from '../../../../../core/geometry/faceted/faceted-extruded-silhouette';
import {
  type FacetedColor,
  StaticFacetedMeshSink,
} from '../../../../../core/geometry/faceted/static-faceted-mesh-sink';
import {
  appendFacetedFirearmSilhouette,
  appendFacetedMuzzleBore,
  appendFacetedSurfacePanel,
  appendFacetedTriggerGuard,
  appendIrregularFirearmTube,
  type FacetedFirearmTubeRing,
} from '../../geometry/faceted-firearm-builder';

const PALETTE = Object.freeze({
  steel: color(0.14, 0.15, 0.145),
  steelLight: color(0.28, 0.3, 0.285),
  steelDark: color(0.025, 0.03, 0.028),
  wood: color(0.45, 0.19, 0.055),
  woodLight: color(0.68, 0.32, 0.085),
  woodDark: color(0.18, 0.06, 0.018),
  bore: color(0.004, 0.006, 0.005),
  epic: color(0.54, 0.12, 0.78),
  sight: color(0.82, 0.12, 0.055),
});

const RECEIVER = points([
  [-0.74, 0.34], [-0.49, 0.56], [0.58, 0.5], [0.78, 0.27],
  [0.66, -0.24], [0.29, -0.39], [-0.57, -0.3], [-0.82, -0.05],
]);
const WOOD_STOCK = points([
  [-2.5, 0.23], [-2.31, 0.54], [-1.68, 0.49], [-0.67, 0.16],
  [-0.72, -0.08], [-1.55, -0.1], [-2.35, -0.25], [-2.61, -0.07],
]);
const WOOD_HANDGUARD = points([
  [0.62, 0.12], [1.57, 0.16], [1.82, 0.02], [1.68, -0.31],
  [0.77, -0.39], [0.55, -0.22],
]);
const WOOD_GRIP = points([
  [-0.64, -0.22], [-0.2, -0.24], [-0.28, -1.02],
  [-0.54, -1.18], [-0.84, -1.03], [-0.9, -0.45],
]);
const CURVED_MAGAZINE = points([
  [0.02, -0.31], [0.5, -0.31], [0.59, -0.7], [0.49, -1.14],
  [0.22, -1.53], [-0.13, -1.65], [-0.36, -1.47], [-0.17, -0.92],
]);
const GAS_BLOCK = points([
  [0.74, 0.4], [1.84, 0.43], [1.96, 0.29], [1.8, 0.14], [0.81, 0.15],
]);

const BARREL_RINGS = Object.freeze([
  ring(1.55, 0.1, 0, 0.09, 0.083, 0.03),
  ring(2.08, 0.105, 0.005, 0.086, 0.078, 0.1),
  ring(2.7, 0.098, -0.003, 0.079, 0.073, 0.045),
  ring(3.03, 0.102, 0.004, 0.112, 0.103, 0.12),
]);

const GAS_TUBE_RINGS = Object.freeze([
  ring(0.55, 0.35, 0, 0.083, 0.076, 0.08),
  ring(1.18, 0.365, -0.004, 0.078, 0.071, 0.02),
  ring(1.88, 0.35, 0.005, 0.074, 0.068, 0.11),
]);

/** 创建木制护木、弯曲弹匣与独立导气机构清晰可辨的 AKM。 */
export function createAkmGeometry() {
  const sink = new StaticFacetedMeshSink();
  appendPart(sink, WOOD_STOCK, 0.215, 0.2, PALETTE.wood, PALETTE.woodDark);
  appendPart(sink, WOOD_GRIP, 0.2, 0.185, PALETTE.wood, PALETTE.woodDark);
  appendPart(sink, CURVED_MAGAZINE, 0.22, 0.205, PALETTE.steel, PALETTE.steelDark);
  appendPart(sink, RECEIVER, 0.245, 0.23, PALETTE.steel, PALETTE.steelDark);
  appendPart(sink, WOOD_HANDGUARD, 0.265, 0.25, PALETTE.wood, PALETTE.woodDark);
  appendPart(sink, GAS_BLOCK, 0.14, 0.132, PALETTE.steel, PALETTE.steelDark);
  appendIrregularFirearmTube(
    sink,
    GAS_TUBE_RINGS,
    6,
    PALETTE.steel,
    PALETTE.steelLight,
  );
  appendIrregularFirearmTube(
    sink,
    BARREL_RINGS,
    7,
    PALETTE.steel,
    PALETTE.steelLight,
  );
  appendFacetedMuzzleBore(
    sink,
    requireLastRing(BARREL_RINGS),
    7,
    0.49,
    0.19,
    PALETTE.steelLight,
    PALETTE.bore,
  );
  appendFacetedTriggerGuard(
    sink,
    points([[-0.42, -0.25], [-0.06, -0.54], [0.33, -0.45], [0.4, -0.24]]),
    0.09,
    0.222,
    0.207,
    PALETTE.steelDark,
    PALETTE.steelLight,
  );
  appendAkmDetails(sink);
  return sink.build();
}

/** 加入机匣盖脊线、木纹切面、照门和准星护翼。 */
function appendAkmDetails(sink: StaticFacetedMeshSink): void {
  appendFacetedSurfacePanel(
    sink,
    points([[-0.47, 0.39], [0.49, 0.37], [0.6, 0.15], [-0.39, 0.12]]),
    0.248,
    PALETTE.steelDark,
  );
  appendFacetedSurfacePanel(
    sink,
    points([[0.73, 0.01], [1.58, 0.02], [1.45, -0.2], [0.84, -0.25]]),
    0.268,
    PALETTE.woodLight,
  );
  appendFacetedSurfacePanel(
    sink,
    points([[-2.27, 0.16], [-1.63, 0.34], [-1.54, 0.16], [-2.18, -0.03]]),
    0.218,
    PALETTE.epic,
  );
  appendPart(
    sink,
    points([[0.25, 0.52], [0.36, 0.72], [0.63, 0.69], [0.67, 0.48]]),
    0.1,
    0.095,
    PALETTE.steelDark,
    PALETTE.steelDark,
  );
  appendPart(
    sink,
    points([[2.45, 0.18], [2.52, 0.54], [2.68, 0.6], [2.82, 0.51], [2.86, 0.14]]),
    0.105,
    0.098,
    PALETTE.steelDark,
    PALETTE.steelDark,
  );
  appendFacetedSurfacePanel(
    sink,
    points([[2.63, 0.51], [2.7, 0.53], [2.72, 0.42], [2.65, 0.41]]),
    0.108,
    PALETTE.sight,
  );
}

function appendPart(
  sink: StaticFacetedMeshSink,
  outline: readonly Readonly<FacetedSilhouettePoint>[],
  frontDepth: number,
  backDepth: number,
  faceColor: Readonly<FacetedColor>,
  edgeColor: Readonly<FacetedColor>,
): void {
  appendFacetedFirearmSilhouette(sink, {
    points: outline,
    frontDepth,
    backDepth,
    faceColor,
    edgeColor,
    accentColor: faceColor === PALETTE.wood ? PALETTE.woodLight : PALETTE.steelLight,
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
    throw new Error('AKM 枪口截面不存在。');
  }
  return value;
}

function color(red: number, green: number, blue: number): Readonly<FacetedColor> {
  return Object.freeze({ red, green, blue, alpha: 1 });
}

/** 模块级复用的 AKM 固定程序化拓扑。 */
export const AKM_GEOMETRY = createAkmGeometry();
