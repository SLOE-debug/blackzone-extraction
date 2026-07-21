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
  caseTop: color(0.08, 0.38, 0.72),
  caseSide: color(0.035, 0.19, 0.42),
  caseDark: color(0.018, 0.075, 0.17),
  caseAccent: color(0.2, 0.62, 0.96),
  brass: color(0.72, 0.48, 0.16),
  brassLight: color(0.96, 0.76, 0.3),
});

const CASE_OUTLINE = Object.freeze([
  Object.freeze({ x: -0.78, z: -0.42 }),
  Object.freeze({ x: 0.57, z: -0.46 }),
  Object.freeze({ x: 0.81, z: -0.25 }),
  Object.freeze({ x: 0.76, z: 0.35 }),
  Object.freeze({ x: 0.49, z: 0.49 }),
  Object.freeze({ x: -0.67, z: 0.44 }),
  Object.freeze({ x: -0.84, z: 0.19 }),
] satisfies readonly AmmunitionPackOutlinePoint[]);

/** 创建带蓝色切角弹盒和外露黄铜弹头的手枪弹药拾取物。 */
export function createHandgunAmmunitionGeometry() {
  const sink = new StaticFacetedMeshSink();
  appendFacetedAmmunitionCase(
    sink,
    CASE_OUTLINE,
    -0.28,
    0.2,
    {
      top: PALETTE.caseTop,
      bottom: PALETTE.caseDark,
      side: PALETTE.caseSide,
      accent: PALETTE.caseAccent,
    },
    0.035,
    -0.025,
  );
  const cartridgePositions = Object.freeze([
    Object.freeze({ x: -0.48, z: -0.16 }),
    Object.freeze({ x: -0.15, z: 0.13 }),
    Object.freeze({ x: 0.19, z: -0.12 }),
    Object.freeze({ x: 0.48, z: 0.16 }),
  ]);
  for (let index = 0; index < cartridgePositions.length; index++) {
    const position = cartridgePositions[index];
    if (position === undefined) {
      throw new Error('手枪弹药展示位索引越界。');
    }
    appendFacetedCartridge(
      sink,
      position.x,
      0.18,
      position.z,
      0.105,
      0.38 + (index % 2) * 0.04,
      6,
      PALETTE.brass,
      PALETTE.brassLight,
      index,
    );
  }
  return sink.build();
}

function color(red: number, green: number, blue: number): Readonly<FacetedColor> {
  return Object.freeze({ red, green, blue, alpha: 1 });
}

/** 模块级复用的手枪弹药固定拓扑。 */
export const HANDGUN_AMMUNITION_GEOMETRY = createHandgunAmmunitionGeometry();
