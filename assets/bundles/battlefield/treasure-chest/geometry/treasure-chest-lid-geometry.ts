import {
  emitOrientedFlatQuad,
} from '../../../../core/geometry/faceted/faceted-emitter';
import { type FacetedPoint } from '../../../../core/geometry/faceted/facet-orientation';
import { StaticFacetedMeshSink } from '../../../../core/geometry/faceted/static-faceted-mesh-sink';
import { TREASURE_CHEST_LAYOUT } from '../model/treasure-chest-layout';
import { TREASURE_CHEST_PALETTE } from './treasure-chest-palette';

interface LidProfileSection {
  readonly z: number;
  readonly y: number;
  readonly halfWidth: number;
}

const LID_PROFILE = Object.freeze([
  Object.freeze({ z: 0, y: 0.018, halfWidth: 1.04 }),
  Object.freeze({ z: 0.14, y: 0.27, halfWidth: 1.09 }),
  Object.freeze({ z: 0.42, y: 0.49, halfWidth: 1.13 }),
  Object.freeze({ z: 0.77, y: 0.55, halfWidth: 1.105 }),
  Object.freeze({ z: 1.09, y: 0.34, halfWidth: 1.065 }),
  Object.freeze({ z: 1.27, y: 0.025, halfWidth: 0.995 }),
] satisfies readonly LidProfileSection[]);

/** 编译具有不等宽拱面和错落切面的宝箱盖固定拓扑。 */
export function createTreasureChestLidGeometry() {
  const sink = new StaticFacetedMeshSink();
  appendArchedShell(sink);
  appendEndFaces(sink);
  appendUnderside(sink);
  appendMetalBand(sink, 0.3, 0.39);
  appendMetalBand(sink, 0.84, 0.94);
  return sink.build();
}

function appendArchedShell(sink: StaticFacetedMeshSink): void {
  for (let index = 0; index < LID_PROFILE.length - 1; index++) {
    const current = requireSection(index);
    const next = requireSection(index + 1);
    const leftCurrent = sectionPoint(current, -1, index);
    const rightCurrent = sectionPoint(current, 1, index);
    const leftNext = sectionPoint(next, -1, index + 1);
    const rightNext = sectionPoint(next, 1, index + 1);
    const color = index % 3 === 0
      ? TREASURE_CHEST_PALETTE.timberLight
      : index % 3 === 1
        ? TREASURE_CHEST_PALETTE.timber
        : TREASURE_CHEST_PALETTE.timberDark;
    emitOrientedFlatQuad(
      sink,
      color,
      leftCurrent,
      rightCurrent,
      rightNext,
      leftNext,
      0,
      1,
      current.z + next.z - 1.1,
    );

    emitOrientedFlatQuad(
      sink,
      index % 2 === 0 ? TREASURE_CHEST_PALETTE.timberDark : TREASURE_CHEST_PALETTE.timber,
      leftCurrent,
      leftNext,
      basePoint(next, -1),
      basePoint(current, -1),
      -1,
      0,
      0,
    );
    emitOrientedFlatQuad(
      sink,
      index % 2 === 0 ? TREASURE_CHEST_PALETTE.timber : TREASURE_CHEST_PALETTE.timberDark,
      rightCurrent,
      basePoint(current, 1),
      basePoint(next, 1),
      rightNext,
      1,
      0,
      0,
    );
  }
}

function appendEndFaces(sink: StaticFacetedMeshSink): void {
  const rear = requireSection(0);
  const front = requireSection(LID_PROFILE.length - 1);
  emitOrientedFlatQuad(
    sink,
    TREASURE_CHEST_PALETTE.metalDark,
    sectionPoint(rear, -1, 0),
    basePoint(rear, -1),
    basePoint(rear, 1),
    sectionPoint(rear, 1, 0),
    0,
    0,
    -1,
  );
  emitOrientedFlatQuad(
    sink,
    TREASURE_CHEST_PALETTE.metal,
    sectionPoint(front, -1, LID_PROFILE.length - 1),
    sectionPoint(front, 1, LID_PROFILE.length - 1),
    basePoint(front, 1),
    basePoint(front, -1),
    0,
    0,
    1,
  );
}

function appendUnderside(sink: StaticFacetedMeshSink): void {
  const rear = requireSection(0);
  const front = requireSection(LID_PROFILE.length - 1);
  emitOrientedFlatQuad(
    sink,
    TREASURE_CHEST_PALETTE.cavity,
    basePoint(rear, -1),
    basePoint(front, -1),
    basePoint(front, 1),
    basePoint(rear, 1),
    0,
    -1,
    0,
  );
}

/** 沿拱面插值一条具有轻微偏心的金属束带。 */
function appendMetalBand(sink: StaticFacetedMeshSink, startZ: number, endZ: number): void {
  const start = sampleProfile(startZ);
  const end = sampleProfile(endZ);
  const widthScale = TREASURE_CHEST_LAYOUT.widthScale;
  const leftStart = Object.freeze({ x: -start.halfWidth * widthScale - 0.018, y: start.y + 0.025, z: start.z });
  const rightStart = Object.freeze({ x: start.halfWidth * widthScale + 0.012, y: start.y + 0.025, z: start.z });
  const leftEnd = Object.freeze({ x: -end.halfWidth * widthScale - 0.014, y: end.y + 0.025, z: end.z });
  const rightEnd = Object.freeze({ x: end.halfWidth * widthScale + 0.02, y: end.y + 0.025, z: end.z });
  emitOrientedFlatQuad(
    sink,
    TREASURE_CHEST_PALETTE.metalLight,
    leftStart,
    rightStart,
    rightEnd,
    leftEnd,
    0,
    1,
    0,
  );
}

function sectionPoint(
  section: Readonly<LidProfileSection>,
  side: -1 | 1,
  index: number,
): Readonly<FacetedPoint> {
  const asymmetry = side < 0 ? (index % 2) * -0.018 : ((index + 1) % 3) * 0.012;
  return Object.freeze({
    x: (side * section.halfWidth + asymmetry) * TREASURE_CHEST_LAYOUT.widthScale,
    y: section.y,
    z: section.z,
  });
}

function basePoint(
  section: Readonly<LidProfileSection>,
  side: -1 | 1,
): Readonly<FacetedPoint> {
  return Object.freeze({
    x: side * (section.halfWidth - 0.035) * TREASURE_CHEST_LAYOUT.widthScale,
    y: 0,
    z: section.z,
  });
}

function sampleProfile(z: number): Readonly<LidProfileSection> {
  for (let index = 0; index < LID_PROFILE.length - 1; index++) {
    const current = requireSection(index);
    const next = requireSection(index + 1);
    if (z < current.z || z > next.z) {
      continue;
    }
    const amount = (z - current.z) / (next.z - current.z);
    return Object.freeze({
      z,
      y: current.y + (next.y - current.y) * amount,
      halfWidth: current.halfWidth + (next.halfWidth - current.halfWidth) * amount,
    });
  }
  throw new Error('宝箱盖束带超出拱面轮廓。');
}

function requireSection(index: number): Readonly<LidProfileSection> {
  const section = LID_PROFILE[index];
  if (section === undefined) {
    throw new Error('宝箱盖轮廓索引越界。');
  }
  return section;
}

/** 模块级复用的宝箱盖固定拓扑。 */
export const TREASURE_CHEST_LID_GEOMETRY = createTreasureChestLidGeometry();
