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
  caseTop: color(0.48, 0.23, 0.055),
  caseSide: color(0.21, 0.085, 0.025),
  caseDark: color(0.075, 0.025, 0.012),
  caseAccent: color(0.78, 0.42, 0.08),
  steelCase: color(0.31, 0.34, 0.29),
  copper: color(0.75, 0.29, 0.09),
});

const CASE_OUTLINE = Object.freeze([
  Object.freeze({ x: -0.84, z: -0.47 }),
  Object.freeze({ x: 0.56, z: -0.51 }),
  Object.freeze({ x: 0.86, z: -0.26 }),
  Object.freeze({ x: 0.79, z: 0.36 }),
  Object.freeze({ x: 0.5, z: 0.5 }),
  Object.freeze({ x: -0.68, z: 0.45 }),
  Object.freeze({ x: -0.89, z: 0.16 }),
] satisfies readonly AmmunitionPackOutlinePoint[]);

/** 创建带赭色切面盒和四枚锥头 7.62×39 弹的拾取几何。 */
export function createSevenSixTwoAmmunitionGeometry() {
  const sink = new StaticFacetedMeshSink();
  appendFacetedAmmunitionCase(sink, CASE_OUTLINE, -0.31, 0.15, {
    top: PALETTE.caseTop,
    bottom: PALETTE.caseDark,
    side: PALETTE.caseSide,
    accent: PALETTE.caseAccent,
  }, -0.035, 0.025);
  const positions = Object.freeze([
    Object.freeze({ x: -0.52, z: -0.14 }),
    Object.freeze({ x: -0.18, z: 0.14 }),
    Object.freeze({ x: 0.19, z: -0.11 }),
    Object.freeze({ x: 0.53, z: 0.15 }),
  ]);
  for (let index = 0; index < positions.length; index++) {
    const position = requirePosition(positions, index);
    appendFacetedCartridge(
      sink, position.x, 0.13, position.z, 0.105, 0.57 + index % 2 * 0.04,
      7, PALETTE.steelCase, PALETTE.copper, index + 23,
    );
  }
  return sink.build();
}

function requirePosition<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) {
    throw new Error('7.62×39 弹药展示位索引越界。');
  }
  return value;
}

function color(red: number, green: number, blue: number): Readonly<FacetedColor> {
  return Object.freeze({ red, green, blue, alpha: 1 });
}

export const SEVEN_SIX_TWO_AMMUNITION_GEOMETRY = createSevenSixTwoAmmunitionGeometry();
