import {
  appendFacetedBlade,
  appendIrregularTube,
  appendSkewedPrism,
  type BattlefieldEnvironmentTubeRing,
  Z_AXIS_TUBE_BASIS,
} from '../battlefield-environment-geometry-kernels';
import {
  type FacetedPoint,
} from '../../../../../core/geometry/faceted/facet-orientation';
import { BattlefieldEnvironmentMeshSink } from '../battlefield-environment-mesh-sink';
import { type BattlefieldEnvironmentMeshPlan } from '../battlefield-environment-mesh-plan';
import { environmentColor } from '../battlefield-environment-colors';

const WRECK_METAL = environmentColor(70, 79, 72);
const WRECK_RUST = environmentColor(104, 64, 42);
const WRECK_DARK = environmentColor(33, 38, 36);
const WRECK_GLASS = environmentColor(38, 81, 82);
const ALTAR_STONE = environmentColor(62, 69, 64);
const ALTAR_METAL = environmentColor(96, 112, 101);
const ALTAR_GLOW = environmentColor(76, 226, 167);

/** 编译扭曲底盘、坍塌驾驶舱、断裂面板和低段数车轮。 */
export function createVehicleWreckMeshPlan(): BattlefieldEnvironmentMeshPlan {
  const sink = new BattlefieldEnvironmentMeshSink();
  appendSkewedPrism(sink, WRECK_METAL, Object.freeze([
    point(-2.35, 0.42, -0.92), point(2.45, 0.34, -0.78),
    point(2.26, 0.38, 0.94), point(-2.5, 0.48, 0.76),
  ]), Object.freeze([
    point(-2.12, 1.18, -0.82), point(2.12, 1.06, -0.68),
    point(1.96, 1.12, 0.82), point(-2.28, 1.28, 0.66),
  ]));
  appendSkewedPrism(sink, WRECK_RUST, Object.freeze([
    point(-0.72, 1.12, -0.68), point(1.28, 1.02, -0.58),
    point(1.08, 1.08, 0.66), point(-0.88, 1.2, 0.58),
  ]), Object.freeze([
    point(-0.46, 2.12, -0.48), point(0.96, 1.72, -0.42),
    point(0.82, 1.78, 0.5), point(-0.62, 2.22, 0.46),
  ]));
  appendSkewedPrism(sink, WRECK_GLASS, Object.freeze([
    point(-0.42, 1.48, -0.7), point(0.88, 1.26, -0.62),
    point(0.78, 1.3, -0.52), point(-0.48, 1.58, -0.58),
  ]), Object.freeze([
    point(-0.36, 2.03, -0.48), point(0.9, 1.68, -0.42),
    point(0.82, 1.72, -0.34), point(-0.42, 2.08, -0.38),
  ]));
  appendWheel(sink, -1.45, 0.56, -0.88, 467);
  appendWheel(sink, 1.52, 0.5, -0.78, 479);
  appendWheel(sink, -1.52, 0.58, 0.78, 487);
  appendWheel(sink, 1.42, 0.5, 0.86, 499);
  appendFacetedBlade(
    sink,
    WRECK_RUST,
    point(1.86, 1.0, -0.62),
    point(2.16, 0.96, -0.52),
    point(3.08, 0.42, -0.18),
    point(2.72, 1.54, 0.16),
  );
  appendFacetedBlade(
    sink,
    WRECK_DARK,
    point(-2.2, 0.92, 0.34),
    point(-2.28, 0.94, 0.68),
    point(-3.0, 0.26, 1.18),
    point(-2.82, 1.34, 0.92),
  );
  return sink.build();
}

/** 编译多圈雕凿祭台、错层肩部和中央发光棱柱。 */
export function createRitualAltarMeshPlan(): BattlefieldEnvironmentMeshPlan {
  const sink = new BattlefieldEnvironmentMeshSink();
  appendIrregularTube(sink, ALTAR_STONE, Object.freeze([
    ring(0, 0, 0, 2.2, 1.92, 0.08),
    ring(0.04, 0.38, -0.02, 2.35, 2.02, -0.04),
    ring(-0.06, 0.68, 0.05, 1.78, 1.54, 0.12),
  ]), 10, 521);
  appendIrregularTube(sink, ALTAR_METAL, Object.freeze([
    ring(-0.06, 0.66, 0.05, 1.72, 1.48, 0.12),
    ring(0.08, 1.08, -0.04, 1.48, 1.27, -0.07),
    ring(-0.04, 1.38, 0.08, 1.08, 0.94, 0.16),
  ]), 9, 541);
  appendIrregularTube(sink, ALTAR_GLOW, Object.freeze([
    ring(0, 1.32, 0, 0.45, 0.38, 0.05),
    ring(0.12, 2.24, -0.08, 0.38, 0.31, -0.09),
    ring(-0.08, 3.26, 0.12, 0.08, 0.065, 0.18),
  ]), 6, 557);
  for (let spike = 0; spike < 5; spike++) {
    const angle = spike / 5 * Math.PI * 2 + 0.2;
    const x = Math.cos(angle) * 1.28;
    const z = Math.sin(angle) * 1.08;
    appendIrregularTube(sink, ALTAR_METAL, Object.freeze([
      ring(x, 1.2, z, 0.14, 0.12, angle),
      ring(x * 1.12, 2.02, z * 1.12, 0.08, 0.07, angle + 0.1),
      ring(x * 1.2, 2.48, z * 1.2, 0.035, 0.03, angle - 0.08),
    ]), 5, 571 + spike * 7);
  }
  return sink.build();
}

function appendWheel(
  sink: BattlefieldEnvironmentMeshSink,
  x: number,
  y: number,
  z: number,
  seed: number,
): void {
  appendIrregularTube(sink, WRECK_DARK, Object.freeze([
    ring(x, y, z - 0.18, 0.48, 0.48, 0.08),
    ring(x, y, z + 0.18, 0.5, 0.46, -0.06),
  ]), 7, seed, Z_AXIS_TUBE_BASIS);
}

function ring(
  x: number,
  y: number,
  z: number,
  radiusU: number,
  radiusV: number,
  rotation: number,
): BattlefieldEnvironmentTubeRing {
  return Object.freeze({ x, y, z, radiusU, radiusV, rotation });
}

function point(x: number, y: number, z: number): FacetedPoint {
  return Object.freeze({ x, y, z });
}
