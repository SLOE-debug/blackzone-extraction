import {
  type FacetedColor,
  StaticFacetedMeshSink,
} from '../../../../core/geometry/faceted/static-faceted-mesh-sink';
import {
  appendFacetedAmmunitionCase,
  appendFacetedCartridge,
  type AmmunitionPackOutlinePoint,
} from './faceted-ammunition-pack-builder';

const PALETTE = Object.freeze({
  caseTop: color(0.32, 0.055, 0.035),
  caseSide: color(0.16, 0.025, 0.022),
  caseDark: color(0.055, 0.012, 0.014),
  caseAccent: color(0.62, 0.11, 0.055),
  shell: color(0.65, 0.055, 0.035),
  brass: color(0.88, 0.57, 0.16),
});

const CASE_OUTLINE = Object.freeze([
  Object.freeze({ x: -0.72, z: -0.5 }),
  Object.freeze({ x: 0.48, z: -0.53 }),
  Object.freeze({ x: 0.79, z: -0.31 }),
  Object.freeze({ x: 0.83, z: 0.29 }),
  Object.freeze({ x: 0.56, z: 0.5 }),
  Object.freeze({ x: -0.58, z: 0.47 }),
  Object.freeze({ x: -0.82, z: 0.18 }),
] satisfies readonly AmmunitionPackOutlinePoint[]);

/** 创建带暗红切角弹盒和外露粗短霰弹壳的霰弹枪弹药拾取物。 */
export function createShotgunAmmunitionGeometry() {
  const sink = new StaticFacetedMeshSink();
  appendFacetedAmmunitionCase(
    sink,
    CASE_OUTLINE,
    -0.3,
    0.16,
    {
      top: PALETTE.caseTop,
      bottom: PALETTE.caseDark,
      side: PALETTE.caseSide,
      accent: PALETTE.caseAccent,
    },
    -0.03,
    0.025,
  );
  const shellPositions = Object.freeze([
    Object.freeze({ x: -0.42, z: -0.12 }),
    Object.freeze({ x: 0, z: 0.13 }),
    Object.freeze({ x: 0.42, z: -0.08 }),
  ]);
  for (let index = 0; index < shellPositions.length; index++) {
    const position = shellPositions[index];
    if (position === undefined) {
      throw new Error('霰弹枪弹药展示位索引越界。');
    }
    appendFacetedCartridge(
      sink,
      position.x,
      0.14,
      position.z,
      0.16,
      0.48 + (index % 2) * 0.06,
      7,
      PALETTE.shell,
      PALETTE.brass,
      index + 4,
    );
  }
  return sink.build();
}

function color(red: number, green: number, blue: number): Readonly<FacetedColor> {
  return Object.freeze({ red, green, blue, alpha: 1 });
}

/** 模块级复用的霰弹枪弹药固定拓扑。 */
export const SHOTGUN_AMMUNITION_GEOMETRY = createShotgunAmmunitionGeometry();
