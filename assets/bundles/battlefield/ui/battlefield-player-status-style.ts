/** 玩家状态 HUD 使用的字节 RGBA 颜色。 */
export interface BattlefieldPlayerStatusColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

/** 右上角单行紧凑生命条的稳定排版和战场色板。 */
export const BATTLEFIELD_PLAYER_STATUS_STYLE = Object.freeze({
  panelWidth: 136,
  panelHeight: 34,
  panelCut: 7,
  rightInset: 22,
  topInset: 18,
  minimumViewportInset: 14,
  labelWidth: 112,
  labelHeight: 26,
  labelFontSize: 18,
  labelLineHeight: 22,
  fillInset: 4,
  fillCut: 4,
  panelBorder: color(91, 126, 118, 246),
  empty: color(35, 25, 24, 238),
  fill: color(177, 51, 44, 255),
  critical: color(239, 69, 52, 255),
  text: color(235, 239, 231, 255),
});

function color(
  red: number,
  green: number,
  blue: number,
  alpha: number,
): BattlefieldPlayerStatusColor {
  return Object.freeze({ red, green, blue, alpha });
}
