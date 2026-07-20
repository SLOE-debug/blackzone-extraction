import { Color, Graphics } from 'cc';
import {
  BATTLEFIELD_PLAYER_STATUS_STYLE,
  type BattlefieldPlayerStatusColor,
} from './battlefield-player-status-style';

const PANEL_BORDER_COLOR = createStatusColor(BATTLEFIELD_PLAYER_STATUS_STYLE.panelBorder);
const EMPTY_COLOR = createStatusColor(BATTLEFIELD_PLAYER_STATUS_STYLE.empty);
const FILL_COLOR = createStatusColor(BATTLEFIELD_PLAYER_STATUS_STYLE.fill);
const CRITICAL_COLOR = createStatusColor(BATTLEFIELD_PLAYER_STATUS_STYLE.critical);

/** 把生命比例绘制为单行削角底槽和内嵌填充。 */
export function drawBattlefieldPlayerStatus(
  graphics: Graphics,
  healthRatio: number,
  centerX: number,
  centerY: number,
  scale: number,
): void {
  const style = BATTLEFIELD_PLAYER_STATUS_STYLE;
  const ratio = Math.max(0, Math.min(healthRatio, 1));
  const innerWidth = style.panelWidth - style.fillInset * 2;
  const innerHeight = style.panelHeight - style.fillInset * 2;
  fillCutPanel(
    graphics,
    centerX,
    centerY,
    style.panelWidth * scale,
    style.panelHeight * scale,
    style.panelCut * scale,
    PANEL_BORDER_COLOR,
  );
  fillCutPanel(
    graphics,
    centerX,
    centerY,
    innerWidth * scale,
    innerHeight * scale,
    (style.panelCut - 2) * scale,
    EMPTY_COLOR,
  );
  drawHealthFill(graphics, ratio, innerWidth, innerHeight, centerX, centerY, scale);
}

/** 从紧凑底槽左端按比例填充，并在极低血量时收窄切角。 */
function drawHealthFill(
  graphics: Graphics,
  ratio: number,
  maximumWidth: number,
  height: number,
  panelCenterX: number,
  panelCenterY: number,
  scale: number,
): void {
  if (ratio <= 0) {
    return;
  }
  const style = BATTLEFIELD_PLAYER_STATUS_STYLE;
  const width = maximumWidth * ratio;
  const centerX = panelCenterX + (-maximumWidth * 0.5 + width * 0.5) * scale;
  fillCutPanel(
    graphics,
    centerX,
    panelCenterY,
    width * scale,
    height * scale,
    Math.min(style.fillCut, width * 0.5) * scale,
    ratio <= 0.25 ? CRITICAL_COLOR : FILL_COLOR,
  );
}

/** 绘制以指定 X 坐标为中心的削角矩形。 */
function fillCutPanel(
  graphics: Graphics,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  cut: number,
  color: Readonly<Color>,
): void {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  graphics.fillColor = color;
  graphics.moveTo(centerX - halfWidth + cut, centerY + halfHeight);
  graphics.lineTo(centerX + halfWidth - cut, centerY + halfHeight);
  graphics.lineTo(centerX + halfWidth, centerY + halfHeight - cut);
  graphics.lineTo(centerX + halfWidth, centerY - halfHeight + cut);
  graphics.lineTo(centerX + halfWidth - cut, centerY - halfHeight);
  graphics.lineTo(centerX - halfWidth + cut, centerY - halfHeight);
  graphics.lineTo(centerX - halfWidth, centerY - halfHeight + cut);
  graphics.lineTo(centerX - halfWidth, centerY + halfHeight - cut);
  graphics.close();
  graphics.fill();
}

function createStatusColor(value: Readonly<BattlefieldPlayerStatusColor>): Color {
  return new Color(value.red, value.green, value.blue, value.alpha);
}
