/** 战场死亡弹窗使用的字节 RGBA 颜色。 */
export interface BattlefieldDefeatDialogColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

/** 死亡弹窗的固定排版、削角和战场色板。 */
export const BATTLEFIELD_DEFEAT_DIALOG_STYLE = Object.freeze({
  panelWidth: 430,
  panelHeight: 238,
  panelCut: 22,
  // 末尾全角感叹号的可见字形重心偏左，需要向右做光学校正。
  titleOpticalOffsetX: 12,
  titleY: 47,
  titleWidth: 366,
  titleHeight: 54,
  titleFontSize: 38,
  titleLineHeight: 44,
  buttonWidth: 224,
  buttonHeight: 54,
  buttonCut: 10,
  buttonY: -67,
  buttonFontSize: 18,
  buttonLineHeight: 24,
  mask: color(2, 4, 5, 214),
  panelBorder: color(157, 70, 56, 255),
  panelSurface: color(28, 18, 18, 252),
  panelFacet: color(47, 25, 23, 255),
  title: color(245, 226, 208, 255),
  buttonBorder: color(117, 176, 157, 255),
  buttonSurface: color(28, 67, 60, 255),
  buttonPending: color(38, 45, 44, 255),
  buttonText: color(224, 242, 233, 255),
});

function color(
  red: number,
  green: number,
  blue: number,
  alpha: number,
): BattlefieldDefeatDialogColor {
  return Object.freeze({ red, green, blue, alpha });
}
