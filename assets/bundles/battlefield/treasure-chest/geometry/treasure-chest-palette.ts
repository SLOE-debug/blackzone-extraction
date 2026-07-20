import { type FacetedColor } from '../../../../core/geometry/faceted/static-faceted-mesh-sink';

/** 宝箱木材、金属和内衬使用的线性顶点色。 */
export const TREASURE_CHEST_PALETTE = Object.freeze({
  timberDark: Object.freeze({ red: 0.24, green: 0.105, blue: 0.035, alpha: 1 }),
  timber: Object.freeze({ red: 0.43, green: 0.205, blue: 0.06, alpha: 1 }),
  timberLight: Object.freeze({ red: 0.58, green: 0.31, blue: 0.095, alpha: 1 }),
  metalDark: Object.freeze({ red: 0.3, green: 0.22, blue: 0.1, alpha: 1 }),
  metal: Object.freeze({ red: 0.6, green: 0.44, blue: 0.18, alpha: 1 }),
  metalLight: Object.freeze({ red: 0.82, green: 0.66, blue: 0.3, alpha: 1 }),
  cavity: Object.freeze({ red: 0.045, green: 0.022, blue: 0.012, alpha: 1 }),
} satisfies Readonly<Record<string, Readonly<FacetedColor>>>);
