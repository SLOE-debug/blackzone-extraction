/** 武器弹药 HUD 使用的字节 RGBA 颜色。 */
export interface BattlefieldWeaponStatusColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

/** 右上角单行武器弹药条的稳定布局和暗色战术色板。 */
export const BATTLEFIELD_WEAPON_STATUS_STYLE = Object.freeze({
  panelWidth: 132,
  panelHeight: 22,
  panelCut: 4,
  rightInset: 16,
  topInset: 38,
  minimumViewportInset: 10,
  nameLabelWidth: 70,
  ammunitionLabelWidth: 54,
  labelHeight: 16,
  nameFontSize: 10,
  nameLineHeight: 12,
  ammunitionFontSize: 13,
  ammunitionLineHeight: 15,
  fillInset: 3,
  reloadBarHeight: 2,
  panel: color(12, 17, 19, 236),
  border: color(71, 132, 137, 248),
  magazine: color(232, 238, 226, 255),
  reserve: color(140, 171, 164, 255),
  muted: color(83, 100, 99, 255),
  reload: color(62, 213, 185, 255),
});

function color(
  red: number,
  green: number,
  blue: number,
  alpha: number,
): BattlefieldWeaponStatusColor {
  return Object.freeze({ red, green, blue, alpha });
}
