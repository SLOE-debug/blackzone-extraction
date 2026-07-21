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
  caseTop: color(0.075, 0.42, 0.43),
  caseSide: color(0.025, 0.19, 0.22),
  caseDark: color(0.012, 0.07, 0.09),
  caseAccent: color(0.08, 0.75, 0.78),
  brass: color(0.76, 0.48, 0.13),
  tip: color(0.28, 0.31, 0.29),
});

const CASE_OUTLINE = Object.freeze([
  Object.freeze({ x: -0.82, z: -0.43 }),
  Object.freeze({ x: 0.55, z: -0.48 }),
  Object.freeze({ x: 0.83, z: -0.24 }),
  Object.freeze({ x: 0.74, z: 0.39 }),
  Object.freeze({ x: 0.46, z: 0.51 }),
  Object.freeze({ x: -0.66, z: 0.45 }),
  Object.freeze({ x: -0.87, z: 0.14 }),
] satisfies readonly AmmunitionPackOutlinePoint[]);

/** 创建带青色切面盒和四枚粗短 .45 ACP 弹的拾取几何。 */
export function createFortyFiveAcpAmmunitionGeometry() {
  const sink = new StaticFacetedMeshSink();
  appendFacetedAmmunitionCase(sink, CASE_OUTLINE, -0.29, 0.18, {
    top: PALETTE.caseTop,
    bottom: PALETTE.caseDark,
    side: PALETTE.caseSide,
    accent: PALETTE.caseAccent,
  }, 0.028, -0.018);
  const positions = Object.freeze([
    Object.freeze({ x: -0.5, z: -0.14 }),
    Object.freeze({ x: -0.16, z: 0.15 }),
    Object.freeze({ x: 0.19, z: -0.12 }),
    Object.freeze({ x: 0.49, z: 0.14 }),
  ]);
  for (let index = 0; index < positions.length; index++) {
    const position = requirePosition(positions, index);
    appendFacetedCartridge(
      sink, position.x, 0.16, position.z, 0.12, 0.34 + index % 2 * 0.035,
      6, PALETTE.brass, PALETTE.tip, index + 9,
    );
  }
  return sink.build();
}

function requirePosition<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) {
    throw new Error('.45 ACP 弹药展示位索引越界。');
  }
  return value;
}

function color(red: number, green: number, blue: number): Readonly<FacetedColor> {
  return Object.freeze({ red, green, blue, alpha: 1 });
}

export const FORTY_FIVE_ACP_AMMUNITION_GEOMETRY =
  createFortyFiveAcpAmmunitionGeometry();
