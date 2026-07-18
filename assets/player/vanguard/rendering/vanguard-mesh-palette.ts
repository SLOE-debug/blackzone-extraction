import { type VanguardMeshPalette } from '../geometry/vanguard-mesh-evaluator';

const BYTE_COLOR_SCALE = 1 / 255;

/** 主角哑光表面按语义索引的稳定颜色与受控分面色差。 */
export const VANGUARD_MATTE_MESH_PALETTE = Object.freeze({
  entries: Object.freeze([
    color(190, 126, 88, 0.06),
    color(190, 126, 88, 0),
    color(48, 27, 25, 0.08),
    color(58, 34, 24, 0.09),
    color(28, 18, 17, 0.065),
    color(46, 30, 24, 0.075),
    color(32, 86, 112, 0.09),
    color(100, 36, 32, 0.075),
    color(38, 43, 49, 0.08),
    color(84, 52, 34, 0.08),
  ] satisfies VanguardMeshPalette['entries']),
}) satisfies VanguardMeshPalette;

/** 创建归一化不透明顶点色与面间变化幅度。 */
function color(
  red: number,
  green: number,
  blue: number,
  facetVariation: number,
): VanguardMeshPalette['entries'][number] {
  return Object.freeze({
    red: red * BYTE_COLOR_SCALE,
    green: green * BYTE_COLOR_SCALE,
    blue: blue * BYTE_COLOR_SCALE,
    alpha: 1,
    facetVariation,
  });
}
