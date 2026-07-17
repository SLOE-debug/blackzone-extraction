import { type VanguardMeshPalette } from '../geometry/vanguard-mesh-evaluator';

const BYTE_COLOR_SCALE = 1 / 255;

/** 主角哑光表面按语义索引的稳定颜色与受控分面色差。 */
export const VANGUARD_MATTE_MESH_PALETTE = Object.freeze({
  entries: Object.freeze([
    color(205, 145, 102, 0.065),
    color(205, 145, 102, 0),
    color(43, 35, 34, 0.1),
    color(73, 45, 28, 0.1),
    color(38, 101, 142, 0.1),
    color(180, 58, 51, 0.1),
    color(31, 49, 61, 0.1),
    color(98, 61, 36, 0.1),
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
