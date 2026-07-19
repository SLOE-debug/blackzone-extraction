import {
  emitOrientedFlatQuad,
  emitOrientedFlatTriangle,
} from '../../../../core/geometry/faceted/faceted-emitter';
import { type FacetedPoint } from '../../../../core/geometry/faceted/facet-orientation';
import {
  type FacetedColor,
  StaticFacetedMeshSink,
} from '../../../../core/geometry/faceted/static-faceted-mesh-sink';
import { TREASURE_CHEST_LAYOUT } from '../model/treasure-chest-layout';
import { TREASURE_CHEST_PALETTE } from './treasure-chest-palette';

const OUTER_BOTTOM = createRing(0.02, 1);
const OUTER_SHOULDER = createRing(0.19, 1.045);
const OUTER_TOP = createRing(0.82, 0.985);
const INNER_RIM = createRing(0.86, 0.76);
const INNER_FLOOR = createRing(0.28, 0.61);

/** 编译起始宝箱的不规则岩雕木箱主体。 */
export function createTreasureChestBodyGeometry() {
  const sink = new StaticFacetedMeshSink();
  appendOuterShell(sink);
  appendCavity(sink);
  appendFrontClasp(sink);
  return sink.build();
}

function appendOuterShell(sink: StaticFacetedMeshSink): void {
  for (let index = 0; index < OUTER_BOTTOM.length; index++) {
    const next = (index + 1) % OUTER_BOTTOM.length;
    const outwardX = ((OUTER_BOTTOM[index]?.x ?? 0) + (OUTER_BOTTOM[next]?.x ?? 0)) * 0.5;
    const outwardZ = ((OUTER_BOTTOM[index]?.z ?? 0) + (OUTER_BOTTOM[next]?.z ?? 0)) * 0.5;
    const lowerColor = selectTimberColor(index);
    const upperColor = selectTimberColor(index + 3);
    emitOrientedFlatQuad(
      sink,
      lowerColor,
      requirePoint(OUTER_BOTTOM, index),
      requirePoint(OUTER_BOTTOM, next),
      requirePoint(OUTER_SHOULDER, next),
      requirePoint(OUTER_SHOULDER, index),
      outwardX,
      0,
      outwardZ,
    );
    emitOrientedFlatQuad(
      sink,
      upperColor,
      requirePoint(OUTER_SHOULDER, index),
      requirePoint(OUTER_SHOULDER, next),
      requirePoint(OUTER_TOP, next),
      requirePoint(OUTER_TOP, index),
      outwardX,
      0.08,
      outwardZ,
    );
  }
}

function appendCavity(sink: StaticFacetedMeshSink): void {
  for (let index = 0; index < OUTER_TOP.length; index++) {
    const next = (index + 1) % OUTER_TOP.length;
    emitOrientedFlatQuad(
      sink,
      index % 3 === 0 ? TREASURE_CHEST_PALETTE.metal : TREASURE_CHEST_PALETTE.timberLight,
      requirePoint(OUTER_TOP, index),
      requirePoint(OUTER_TOP, next),
      requirePoint(INNER_RIM, next),
      requirePoint(INNER_RIM, index),
      0,
      1,
      0,
    );
    const inwardX = -((INNER_RIM[index]?.x ?? 0) + (INNER_RIM[next]?.x ?? 0)) * 0.5;
    const inwardZ = -((INNER_RIM[index]?.z ?? 0) + (INNER_RIM[next]?.z ?? 0)) * 0.5;
    emitOrientedFlatQuad(
      sink,
      TREASURE_CHEST_PALETTE.cavity,
      requirePoint(INNER_RIM, index),
      requirePoint(INNER_RIM, next),
      requirePoint(INNER_FLOOR, next),
      requirePoint(INNER_FLOOR, index),
      inwardX,
      0.1,
      inwardZ,
    );
  }

  const center = Object.freeze({ x: 0.025, y: 0.275, z: -0.015 });
  for (let index = 0; index < INNER_FLOOR.length; index++) {
    const next = (index + 1) % INNER_FLOOR.length;
    emitOrientedFlatTriangle(
      sink,
      TREASURE_CHEST_PALETTE.cavity,
      center,
      requirePoint(INNER_FLOOR, index),
      requirePoint(INNER_FLOOR, next),
      0,
      1,
      0,
    );
  }
}

/** 在面向玩家的一侧写入具有厚度的五边形锁扣，而不是叠放规则 Box。 */
function appendFrontClasp(sink: StaticFacetedMeshSink): void {
  const backZ = 0.665;
  const frontZ = 0.735;
  const back = createClaspRing(backZ);
  const front = createClaspRing(frontZ);
  const center = Object.freeze({ x: 0.018, y: 0.49, z: frontZ });
  for (let index = 0; index < front.length; index++) {
    const next = (index + 1) % front.length;
    emitOrientedFlatTriangle(
      sink,
      index % 2 === 0 ? TREASURE_CHEST_PALETTE.metalLight : TREASURE_CHEST_PALETTE.metal,
      center,
      requirePoint(front, index),
      requirePoint(front, next),
      0,
      0,
      1,
    );
    const outwardX = ((front[index]?.x ?? 0) + (front[next]?.x ?? 0)) * 0.5;
    const outwardY = ((front[index]?.y ?? 0) + (front[next]?.y ?? 0)) * 0.5 - center.y;
    emitOrientedFlatQuad(
      sink,
      TREASURE_CHEST_PALETTE.metalDark,
      requirePoint(back, index),
      requirePoint(back, next),
      requirePoint(front, next),
      requirePoint(front, index),
      outwardX,
      outwardY,
      0,
    );
  }
}

function createRing(y: number, scale: number): readonly Readonly<FacetedPoint>[] {
  const widthScale = scale * TREASURE_CHEST_LAYOUT.widthScale;
  return Object.freeze([
    Object.freeze({ x: -1.13 * widthScale, y, z: -0.49 * scale }),
    Object.freeze({ x: -0.77 * widthScale, y: -0.018 + y, z: -0.67 * scale }),
    Object.freeze({ x: 0.73 * widthScale, y: 0.012 + y, z: -0.65 * scale }),
    Object.freeze({ x: 1.16 * widthScale, y: -0.006 + y, z: -0.43 * scale }),
    Object.freeze({ x: 1.19 * widthScale, y: 0.008 + y, z: 0.46 * scale }),
    Object.freeze({ x: 0.79 * widthScale, y: -0.01 + y, z: 0.68 * scale }),
    Object.freeze({ x: -0.81 * widthScale, y: 0.015 + y, z: 0.65 * scale }),
    Object.freeze({ x: -1.17 * widthScale, y: -0.004 + y, z: 0.42 * scale }),
  ]);
}

function createClaspRing(z: number): readonly Readonly<FacetedPoint>[] {
  return Object.freeze([
    Object.freeze({ x: -0.25, y: 0.69, z }),
    Object.freeze({ x: 0.22, y: 0.72, z }),
    Object.freeze({ x: 0.3, y: 0.48, z }),
    Object.freeze({ x: 0.14, y: 0.27, z }),
    Object.freeze({ x: -0.19, y: 0.29, z }),
    Object.freeze({ x: -0.31, y: 0.5, z }),
  ]);
}

function selectTimberColor(index: number): Readonly<FacetedColor> {
  switch (index % 3) {
    case 0:
      return TREASURE_CHEST_PALETTE.timberDark;
    case 1:
      return TREASURE_CHEST_PALETTE.timber;
    default:
      return TREASURE_CHEST_PALETTE.timberLight;
  }
}

function requirePoint(
  points: readonly Readonly<FacetedPoint>[],
  index: number,
): Readonly<FacetedPoint> {
  const point = points[index];
  if (point === undefined) {
    throw new Error('宝箱主体轮廓索引越界。');
  }
  return point;
}

/** 模块级复用的宝箱主体固定拓扑。 */
export const TREASURE_CHEST_BODY_GEOMETRY = createTreasureChestBodyGeometry();
