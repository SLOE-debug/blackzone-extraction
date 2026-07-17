import { Color, Graphics } from 'cc';
import {
  type LoadingOverlayColor,
  SCENE_LOADING_OVERLAY_STYLE,
} from './scene-loading-overlay-style';

const TAU = Math.PI * 2;

/** 绘制全屏遮罩、仪表面板、旋转分片和阶段进度。 */
export function drawSceneLoadingOverlay(
  graphics: Graphics,
  width: number,
  height: number,
  progress: number,
  rotation: number,
  failed: boolean,
): void {
  const style = SCENE_LOADING_OVERLAY_STYLE;
  graphics.clear();
  graphics.fillColor = createColor(style.mask);
  graphics.rect(-width * 0.5, -height * 0.5, width, height);
  graphics.fill();

  fillCutCornerPanel(
    graphics,
    style.panelWidth,
    style.panelHeight,
    style.panelCornerCut,
    -8,
    style.panelShadow,
  );
  fillCutCornerPanel(
    graphics,
    style.panelWidth,
    style.panelHeight,
    style.panelCornerCut,
    0,
    style.panelBorder,
  );
  fillCutCornerPanel(
    graphics,
    style.panelWidth - 6,
    style.panelHeight - 6,
    style.panelCornerCut - 3,
    0,
    style.panelSurface,
  );
  drawPanelFacet(graphics);
  drawSpinner(graphics, rotation, failed);
  drawProgressTrack(graphics, progress, failed);
}

/** 把 Loading 配置颜色转换为 Cocos Color。 */
export function createLoadingOverlayColor(color: Readonly<LoadingOverlayColor>): Color {
  return createColor(color);
}

function fillCutCornerPanel(
  graphics: Graphics,
  width: number,
  height: number,
  cornerCut: number,
  offsetY: number,
  color: Readonly<LoadingOverlayColor>,
): void {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  graphics.fillColor = createColor(color);
  graphics.moveTo(-halfWidth + cornerCut, offsetY + halfHeight);
  graphics.lineTo(halfWidth - cornerCut, offsetY + halfHeight);
  graphics.lineTo(halfWidth, offsetY + halfHeight - cornerCut);
  graphics.lineTo(halfWidth, offsetY - halfHeight + cornerCut);
  graphics.lineTo(halfWidth - cornerCut, offsetY - halfHeight);
  graphics.lineTo(-halfWidth + cornerCut, offsetY - halfHeight);
  graphics.lineTo(-halfWidth, offsetY - halfHeight + cornerCut);
  graphics.lineTo(-halfWidth, offsetY + halfHeight - cornerCut);
  graphics.close();
  graphics.fill();
}

function drawPanelFacet(graphics: Graphics): void {
  const style = SCENE_LOADING_OVERLAY_STYLE;
  const halfWidth = style.panelWidth * 0.5 - 15;
  const top = style.panelHeight * 0.5 - 15;
  graphics.fillColor = createColor(style.panelFacet);
  graphics.moveTo(-halfWidth + 16, top);
  graphics.lineTo(halfWidth - 42, top);
  graphics.lineTo(halfWidth - 66, top - 12);
  graphics.lineTo(-halfWidth + 35, top - 12);
  graphics.close();
  graphics.fill();

  graphics.fillColor = createColor(style.accentDim);
  graphics.rect(-halfWidth + 20, -top + 17, 86, 3);
  graphics.rect(halfWidth - 106, -top + 17, 86, 3);
  graphics.fill();
}

function drawSpinner(graphics: Graphics, rotation: number, failed: boolean): void {
  const style = SCENE_LOADING_OVERLAY_STYLE;
  const baseColor = failed ? style.error : style.accent;
  const centerY = style.spinnerY;
  for (let segment = 0; segment < style.spinnerSegmentCount; segment++) {
    const phase = segment / style.spinnerSegmentCount;
    const angle = rotation + phase * TAU;
    const radialX = Math.cos(angle);
    const radialY = Math.sin(angle);
    const tangentX = -radialY;
    const tangentY = radialX;
    const innerRadius = style.spinnerRadius - style.spinnerSegmentLength;
    const outerRadius = style.spinnerRadius + style.spinnerSegmentLength;
    const halfWidth = style.spinnerSegmentWidth;
    const alpha = Math.round(48 + phase * 207);
    graphics.fillColor = new Color(baseColor.red, baseColor.green, baseColor.blue, alpha);
    graphics.moveTo(
      radialX * innerRadius + tangentX * halfWidth,
      centerY + radialY * innerRadius + tangentY * halfWidth,
    );
    graphics.lineTo(
      radialX * outerRadius + tangentX * halfWidth,
      centerY + radialY * outerRadius + tangentY * halfWidth,
    );
    graphics.lineTo(
      radialX * outerRadius - tangentX * halfWidth,
      centerY + radialY * outerRadius - tangentY * halfWidth,
    );
    graphics.lineTo(
      radialX * innerRadius - tangentX * halfWidth,
      centerY + radialY * innerRadius - tangentY * halfWidth,
    );
    graphics.close();
    graphics.fill();
  }
}

function drawProgressTrack(graphics: Graphics, progress: number, failed: boolean): void {
  const style = SCENE_LOADING_OVERLAY_STYLE;
  const left = -style.progressWidth * 0.5;
  graphics.fillColor = createColor(style.track);
  graphics.rect(left, style.progressY, style.progressWidth, style.progressHeight);
  graphics.fill();

  const fillWidth = style.progressWidth * Math.max(0, Math.min(progress, 1));
  if (fillWidth <= 0) {
    return;
  }
  graphics.fillColor = createColor(failed ? style.error : style.accent);
  graphics.rect(left, style.progressY, fillWidth, style.progressHeight);
  graphics.fill();
}

function createColor(color: Readonly<LoadingOverlayColor>): Color {
  return new Color(color.red, color.green, color.blue, color.alpha);
}
