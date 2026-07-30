import { type FacetedColor } from '../../../../../core/geometry/faceted/static-faceted-mesh-sink';

/** 裂岩大锤木材、矿钢、铜嵌片和结构暗槽的稳定基础色。 */
export const SLEDGEHAMMER_PALETTE = Object.freeze({
  woodDark: color(0.18, 0.075, 0.025),
  wood: color(0.38, 0.18, 0.055),
  woodLight: color(0.56, 0.31, 0.12),
  ironDark: color(0.1, 0.12, 0.13),
  iron: color(0.34, 0.38, 0.39),
  ironLight: color(0.62, 0.66, 0.63),
  copper: color(0.92, 0.43, 0.07),
  cavity: color(0.055, 0.035, 0.025),
} satisfies Readonly<Record<string, Readonly<FacetedColor>>>);

function color(red: number, green: number, blue: number): Readonly<FacetedColor> {
  return Object.freeze({ red, green, blue, alpha: 1 });
}
