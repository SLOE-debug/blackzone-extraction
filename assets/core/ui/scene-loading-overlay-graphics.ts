import { Color, Graphics } from 'cc';
import {
  type LoadingOverlayColor,
  SCENE_LOADING_OVERLAY_STYLE,
} from './scene-loading-overlay-style';

const STYLE = SCENE_LOADING_OVERLAY_STYLE;
const MASK_COLOR = createColor(STYLE.mask);
const PANEL_BORDER_COLOR = createColor(STYLE.panelBorder);
const PANEL_SURFACE_COLOR = createColor(STYLE.panelSurface);
const TRACK_COLOR = createColor(STYLE.track);
const ACCENT_COLOR = createColor(STYLE.accent);
const ACCENT_DIM_COLOR = createColor(STYLE.accentDim);
const ERROR_COLOR = createColor(STYLE.error);
const animatedColor = new Color();

/** 绘制全屏遮罩、扁平加载卡片、呼吸指示点和阶段进度。 */
export function drawSceneLoadingOverlay(
  graphics: Graphics,
  width: number,
  height: number,
  progress: number,
  animationPhase: number,
  failed: boolean,
): void {
  graphics.clear();
  fillRect(graphics, -width * 0.5, -height * 0.5, width, height, MASK_COLOR);
  drawPanel(graphics);
  if (failed) {
    drawFailureIndicator(graphics);
  } else {
    drawActivityIndicator(graphics, animationPhase);
  }
  drawProgressTrack(graphics, progress, failed);
}

/** 把 Loading 配置颜色转换为 Cocos Color。 */
export function createLoadingOverlayColor(color: Readonly<LoadingOverlayColor>): Color {
  return createColor(color);
}

/** 绘制无阴影的圆角扁平卡片，并用短线保留轻量视觉焦点。 */
function drawPanel(graphics: Graphics): void {
  fillRoundedRect(
    graphics,
    STYLE.panelWidth,
    STYLE.panelHeight,
    STYLE.panelCornerRadius,
    PANEL_BORDER_COLOR,
  );
  fillRoundedRect(
    graphics,
    STYLE.panelWidth - 4,
    STYLE.panelHeight - 4,
    STYLE.panelCornerRadius - 2,
    PANEL_SURFACE_COLOR,
  );
  fillRoundedRect(graphics, 88, 3, 1.5, ACCENT_DIM_COLOR, STYLE.panelHeight * 0.5 - 12);
}

/** 绘制从左到右循环呼吸的三点动画。 */
function drawActivityIndicator(graphics: Graphics, animationPhase: number): void {
  for (let index = 0; index < 3; index++) {
    const phase = animationPhase - index * 0.78;
    const pulse = (Math.sin(phase) + 1) * 0.5;
    const radius = STYLE.indicatorRadius * (0.78 + pulse * 0.32);
    const alpha = Math.round(86 + pulse * 169);
    animatedColor.set(
      STYLE.accent.red,
      STYLE.accent.green,
      STYLE.accent.blue,
      alpha,
    );
    const x = (index - 1) * STYLE.indicatorSpacing;
    fillCircle(graphics, x, STYLE.indicatorY, radius, animatedColor);
  }
}

/** 错误状态用静态圆形叹号替代持续动画。 */
function drawFailureIndicator(graphics: Graphics): void {
  graphics.strokeColor = ERROR_COLOR;
  graphics.lineWidth = 3;
  graphics.circle(0, STYLE.indicatorY, 12);
  graphics.stroke();
  fillRoundedRect(graphics, 3, 10, 1.5, ERROR_COLOR, STYLE.indicatorY + 2);
  fillCircle(graphics, 0, STYLE.indicatorY - 6, 1.8, ERROR_COLOR);
}

/** 绘制圆角进度轨道及当前完成段。 */
function drawProgressTrack(graphics: Graphics, progress: number, failed: boolean): void {
  const clampedProgress = Math.max(0, Math.min(progress, 1));
  const left = -STYLE.progressWidth * 0.5;
  fillRoundedRectAt(
    graphics,
    left,
    STYLE.progressY,
    STYLE.progressWidth,
    STYLE.progressHeight,
    STYLE.progressHeight * 0.5,
    TRACK_COLOR,
  );

  const fillWidth = STYLE.progressWidth * clampedProgress;
  if (fillWidth <= 0) {
    return;
  }
  fillRoundedRectAt(
    graphics,
    left,
    STYLE.progressY,
    fillWidth,
    STYLE.progressHeight,
    Math.min(STYLE.progressHeight * 0.5, fillWidth * 0.5),
    failed ? ERROR_COLOR : ACCENT_COLOR,
  );
}

/** 以中心点和可选 Y 偏移填充圆角矩形。 */
function fillRoundedRect(
  graphics: Graphics,
  width: number,
  height: number,
  radius: number,
  color: Readonly<Color>,
  centerY = 0,
): void {
  fillRoundedRectAt(
    graphics,
    -width * 0.5,
    centerY - height * 0.5,
    width,
    height,
    radius,
    color,
  );
}

/** 按左下角坐标填充圆角矩形。 */
function fillRoundedRectAt(
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: Readonly<Color>,
): void {
  graphics.fillColor = color;
  graphics.roundRect(x, y, width, height, radius);
  graphics.fill();
}

/** 填充普通矩形。 */
function fillRect(
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  color: Readonly<Color>,
): void {
  graphics.fillColor = color;
  graphics.rect(x, y, width, height);
  graphics.fill();
}

/** 填充圆形。 */
function fillCircle(
  graphics: Graphics,
  x: number,
  y: number,
  radius: number,
  color: Readonly<Color>,
): void {
  graphics.fillColor = color;
  graphics.circle(x, y, radius);
  graphics.fill();
}

function createColor(color: Readonly<LoadingOverlayColor>): Color {
  return new Color(color.red, color.green, color.blue, color.alpha);
}
