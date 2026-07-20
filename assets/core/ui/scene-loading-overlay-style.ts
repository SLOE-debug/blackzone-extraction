/** Loading 遮罩使用的字节 RGBA 颜色。 */
export interface LoadingOverlayColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

/** Loading 遮罩的固定尺寸、动画和色板。 */
export const SCENE_LOADING_OVERLAY_STYLE = Object.freeze({
  panelWidth: 468,
  panelHeight: 174,
  panelCornerRadius: 16,
  indicatorY: 51,
  indicatorSpacing: 18,
  indicatorRadius: 4,
  progressWidth: 360,
  progressHeight: 7,
  progressY: -28,
  statusY: 15,
  percentageY: -57,
  fadeSpeed: 1040,
  progressResponse: 16,
  pulseSpeed: 4.2,
  mask: createColor(3, 7, 9, 226),
  panelBorder: createColor(91, 143, 132, 232),
  panelSurface: createColor(17, 31, 31, 250),
  track: createColor(7, 18, 18, 255),
  accent: createColor(139, 218, 193, 255),
  accentDim: createColor(73, 117, 107, 190),
  text: createColor(229, 239, 231, 255),
  error: createColor(226, 105, 92, 255),
});

function createColor(
  red: number,
  green: number,
  blue: number,
  alpha: number,
): LoadingOverlayColor {
  return Object.freeze({ red, green, blue, alpha });
}
