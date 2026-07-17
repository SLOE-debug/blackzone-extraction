/** Loading 遮罩使用的字节 RGBA 颜色。 */
export interface LoadingOverlayColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

/** Loading 遮罩的固定尺寸、动画和色板。 */
export const SCENE_LOADING_OVERLAY_STYLE = Object.freeze({
  panelWidth: 520,
  panelHeight: 226,
  panelCornerCut: 22,
  spinnerRadius: 44,
  spinnerY: 53,
  spinnerSegmentCount: 12,
  spinnerSegmentLength: 9,
  spinnerSegmentWidth: 3.2,
  progressWidth: 382,
  progressHeight: 8,
  progressY: -62,
  statusY: -14,
  percentageY: -94,
  fadeSpeed: 920,
  progressResponse: 8,
  rotationSpeed: 2.45,
  mask: createColor(4, 6, 10, 232),
  panelShadow: createColor(0, 0, 0, 154),
  panelBorder: createColor(128, 190, 184, 230),
  panelSurface: createColor(10, 29, 34, 246),
  panelFacet: createColor(18, 49, 54, 232),
  track: createColor(4, 13, 16, 235),
  accent: createColor(139, 231, 217, 255),
  accentDim: createColor(52, 104, 103, 200),
  text: createColor(236, 245, 233, 255),
  textOutline: createColor(3, 17, 20, 255),
  error: createColor(235, 100, 91, 255),
});

function createColor(
  red: number,
  green: number,
  blue: number,
  alpha: number,
): LoadingOverlayColor {
  return Object.freeze({ red, green, blue, alpha });
}
