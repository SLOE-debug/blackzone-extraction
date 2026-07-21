import {
  type FacetedColor,
  StaticFacetedMeshSink,
} from '../../../../../core/geometry/faceted/static-faceted-mesh-sink';
import {
  appendFacetedAmmunitionCase,
  appendFacetedCartridge,
  type AmmunitionPackOutlinePoint,
} from '../../geometry/faceted-ammunition-pack-builder';

const PALETTE = Object.freeze({
  caseTop: color(0.2, 0.4, 0.15),
  caseSide: color(0.075, 0.19, 0.06),
  caseDark: color(0.025, 0.075, 0.02),
  caseAccent: color(0.42, 0.69, 0.21),
  brass: color(0.78, 0.52, 0.14),
  tip: color(0.22, 0.24, 0.2),
});

const CASE_OUTLINE = Object.freeze([
  Object.freeze({ x: -0.86, z: -0.42 }),
  Object.freeze({ x: 0.61, z: -0.47 }),
  Object.freeze({ x: 0.87, z: -0.21 }),
  Object.freeze({ x: 0.76, z: 0.4 }),
  Object.freeze({ x: 0.5, z: 0.52 }),
  Object.freeze({ x: -0.71, z: 0.46 }),
  Object.freeze({ x: -0.9, z: 0.12 }),
] satisfies readonly AmmunitionPackOutlinePoint[]);

/** 创建带军绿色切面盒和五枚细长 5.56×45 弹的拾取几何。 */
export function createFiveFiveSixNatoAmmunitionGeometry() {
  const sink = new StaticFacetedMeshSink();
  appendFacetedAmmunitionCase(sink, CASE_OUTLINE, -0.3, 0.16, {
    top: PALETTE.caseTop,
    bottom: PALETTE.caseDark,
    side: PALETTE.caseSide,
    accent: PALETTE.caseAccent,
  }, 0.04, 0.02);
  const positions = Object.freeze([
    Object.freeze({ x: -0.58, z: -0.16 }),
    Object.freeze({ x: -0.3, z: 0.15 }),
    Object.freeze({ x: 0, z: -0.12 }),
    Object.freeze({ x: 0.29, z: 0.16 }),
    Object.freeze({ x: 0.57, z: -0.1 }),
  ]);
  for (let index = 0; index < positions.length; index++) {
    const position = requirePosition(positions, index);
    appendFacetedCartridge(
      sink, position.x, 0.14, position.z, 0.082, 0.52 + index % 2 * 0.045,
      6, PALETTE.brass, PALETTE.tip, index + 15,
    );
  }
  return sink.build();
}

function requirePosition<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) {
    throw new Error('5.56×45 弹药展示位索引越界。');
  }
  return value;
}

function color(red: number, green: number, blue: number): Readonly<FacetedColor> {
  return Object.freeze({ red, green, blue, alpha: 1 });
}

export const FIVE_FIVE_SIX_NATO_AMMUNITION_GEOMETRY =
  createFiveFiveSixNatoAmmunitionGeometry();
