import { Color, Graphics } from 'cc';
import {
  BATTLEFIELD_WEAPON_STATUS_STYLE,
  type BattlefieldWeaponStatusColor,
} from './battlefield-weapon-status-style';

const PANEL_COLOR = createColor(BATTLEFIELD_WEAPON_STATUS_STYLE.panel);
const BORDER_COLOR = createColor(BATTLEFIELD_WEAPON_STATUS_STYLE.border);
const MUTED_COLOR = createColor(BATTLEFIELD_WEAPON_STATUS_STYLE.muted);
const RELOAD_COLOR = createColor(BATTLEFIELD_WEAPON_STATUS_STYLE.reload);

/** 绘制单行弹药底槽、弹匣余量和换弹进度。 */
export function drawBattlefieldWeaponStatus(
  graphics: Graphics,
  centerX: number,
  centerY: number,
  scale: number,
  magazineRatio: number,
  reloading: boolean,
  reloadProgress: number,
): void {
  const style = BATTLEFIELD_WEAPON_STATUS_STYLE;
  const width = style.panelWidth * scale;
  const height = style.panelHeight * scale;
  fillCutPanel(graphics, centerX, centerY, width, height, style.panelCut * scale, BORDER_COLOR);
  const innerWidth = (style.panelWidth - style.fillInset * 2) * scale;
  const innerHeight = (style.panelHeight - style.fillInset * 2) * scale;
  fillCutPanel(graphics, centerX, centerY, innerWidth, innerHeight, 2 * scale, PANEL_COLOR);
  drawMagazineFill(
    graphics,
    centerX,
    centerY,
    innerWidth,
    innerHeight,
    Math.max(0, Math.min(magazineRatio, 1)),
  );
  if (reloading) {
    drawReloadBar(graphics, centerX, centerY - height * 0.5 + 2 * scale, reloadProgress, scale);
  }
}

/** 用低透明细填充表达当前弹匣比例，不增加额外刻度噪声。 */
function drawMagazineFill(
  graphics: Graphics,
  centerX: number,
  centerY: number,
  maximumWidth: number,
  height: number,
  ratio: number,
): void {
  if (ratio <= 0) {
    return;
  }
  const width = maximumWidth * ratio;
  graphics.fillColor = MUTED_COLOR;
  graphics.rect(
    centerX - maximumWidth * 0.5,
    centerY - height * 0.5,
    width,
    height,
  );
  graphics.fill();
}

function drawReloadBar(
  graphics: Graphics,
  centerX: number,
  centerY: number,
  progress: number,
  scale: number,
): void {
  const style = BATTLEFIELD_WEAPON_STATUS_STYLE;
  const width = (style.panelWidth - style.fillInset * 2) * scale;
  const height = style.reloadBarHeight * scale;
  graphics.fillColor = MUTED_COLOR;
  graphics.rect(centerX - width * 0.5, centerY - height * 0.5, width, height);
  graphics.fill();
  graphics.fillColor = RELOAD_COLOR;
  graphics.rect(
    centerX - width * 0.5,
    centerY - height * 0.5,
    width * Math.max(0, Math.min(progress, 1)),
    height,
  );
  graphics.fill();
}

function fillCutPanel(
  graphics: Graphics,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  cut: number,
  color: Readonly<Color>,
): void {
  traceCutPanel(graphics, centerX, centerY, width, height, cut);
  graphics.fillColor = color;
  graphics.fill();
}

function traceCutPanel(
  graphics: Graphics,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  cut: number,
): void {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  graphics.moveTo(centerX - halfWidth + cut, centerY + halfHeight);
  graphics.lineTo(centerX + halfWidth - cut, centerY + halfHeight);
  graphics.lineTo(centerX + halfWidth, centerY + halfHeight - cut);
  graphics.lineTo(centerX + halfWidth, centerY - halfHeight + cut);
  graphics.lineTo(centerX + halfWidth - cut, centerY - halfHeight);
  graphics.lineTo(centerX - halfWidth + cut, centerY - halfHeight);
  graphics.lineTo(centerX - halfWidth, centerY - halfHeight + cut);
  graphics.lineTo(centerX - halfWidth, centerY + halfHeight - cut);
  graphics.close();
}

function createColor(value: Readonly<BattlefieldWeaponStatusColor>): Color {
  return new Color(value.red, value.green, value.blue, value.alpha);
}
