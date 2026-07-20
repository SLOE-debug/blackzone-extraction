import { Color, Graphics } from 'cc';
import {
  BATTLEFIELD_PLAYER_STATUS_STYLE,
  type BattlefieldPlayerStatusColor,
} from './battlefield-player-status-style';

/** 把生命比例绘制为单行削角底槽和内嵌填充。 */
export function drawBattlefieldPlayerStatus(
  graphics: Graphics,
  healthRatio: number,
): void {
  const style = BATTLEFIELD_PLAYER_STATUS_STYLE;
  const ratio = Math.max(0, Math.min(healthRatio, 1));
  const innerWidth = style.panelWidth - style.fillInset * 2;
  const innerHeight = style.panelHeight - style.fillInset * 2;
  graphics.clear();
  fillCutPanel(
    graphics,
    0,
    style.panelWidth,
    style.panelHeight,
    style.panelCut,
    style.panelBorder,
  );
  fillCutPanel(
    graphics,
    0,
    innerWidth,
    innerHeight,
    style.panelCut - 2,
    style.empty,
  );
  drawHealthFill(graphics, ratio, innerWidth, innerHeight);
}

/** 从紧凑底槽左端按比例填充，并在极低血量时收窄切角。 */
function drawHealthFill(
  graphics: Graphics,
  ratio: number,
  maximumWidth: number,
  height: number,
): void {
  if (ratio <= 0) {
    return;
  }
  const style = BATTLEFIELD_PLAYER_STATUS_STYLE;
  const width = maximumWidth * ratio;
  const centerX = -maximumWidth * 0.5 + width * 0.5;
  fillCutPanel(
    graphics,
    centerX,
    width,
    height,
    Math.min(style.fillCut, width * 0.5),
    ratio <= 0.25 ? style.critical : style.fill,
  );
}

/** 绘制以指定 X 坐标为中心的削角矩形。 */
function fillCutPanel(
  graphics: Graphics,
  centerX: number,
  width: number,
  height: number,
  cut: number,
  color: Readonly<BattlefieldPlayerStatusColor>,
): void {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  graphics.fillColor = createStatusColor(color);
  graphics.moveTo(centerX - halfWidth + cut, halfHeight);
  graphics.lineTo(centerX + halfWidth - cut, halfHeight);
  graphics.lineTo(centerX + halfWidth, halfHeight - cut);
  graphics.lineTo(centerX + halfWidth, -halfHeight + cut);
  graphics.lineTo(centerX + halfWidth - cut, -halfHeight);
  graphics.lineTo(centerX - halfWidth + cut, -halfHeight);
  graphics.lineTo(centerX - halfWidth, -halfHeight + cut);
  graphics.lineTo(centerX - halfWidth, halfHeight - cut);
  graphics.close();
  graphics.fill();
}

function createStatusColor(value: Readonly<BattlefieldPlayerStatusColor>): Color {
  return new Color(value.red, value.green, value.blue, value.alpha);
}
