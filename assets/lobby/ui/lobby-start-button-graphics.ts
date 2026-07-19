import { Color, Graphics } from 'cc';
import {
  LOBBY_START_BUTTON_STYLE,
  type LobbyStartButtonPalette,
  type LobbyUiColor,
} from '../model/lobby-start-button-style';

const BORDER_INSET = 4;
const INNER_FACET_INSET = 12;
const TOP_HIGHLIGHT_HEIGHT = 5;
const SIDE_MARKER_WIDTH = 14;

/** 绘制带阴影、黄铜边和青铜分面的削角按钮。 */
export function drawLobbyStartButtonPlate(
  graphics: Graphics,
  palette: Readonly<LobbyStartButtonPalette>,
): void {
  const style = LOBBY_START_BUTTON_STYLE;
  graphics.clear();
  fillCutCornerPlate(
    graphics,
    style.width,
    style.height,
    style.cornerCut,
    0,
    style.shadowOffsetY,
    palette.shadow,
  );
  fillCutCornerPlate(
    graphics,
    style.width,
    style.height,
    style.cornerCut,
    0,
    0,
    palette.border,
  );
  fillCutCornerPlate(
    graphics,
    style.width - BORDER_INSET * 2,
    style.height - BORDER_INSET * 2,
    style.cornerCut - BORDER_INSET,
    0,
    0,
    palette.surface,
  );
  fillCutCornerPlate(
    graphics,
    style.width - INNER_FACET_INSET * 2,
    style.height - INNER_FACET_INSET * 2,
    style.cornerCut - BORDER_INSET,
    0,
    -1,
    palette.innerFacet,
  );
  drawTopHighlight(graphics, palette.accent);
  drawSideMarkers(graphics, palette.accent);
}

/** 把无引擎依赖的配置颜色转换为 Cocos Color。 */
export function createLobbyUiColor(color: Readonly<LobbyUiColor>): Color {
  return new Color(color.red, color.green, color.blue, color.alpha);
}

/** 绘制确定性八边削角面板。 */
function fillCutCornerPlate(
  graphics: Graphics,
  width: number,
  height: number,
  cornerCut: number,
  offsetX: number,
  offsetY: number,
  color: Readonly<LobbyUiColor>,
): void {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  graphics.fillColor = createLobbyUiColor(color);
  graphics.moveTo(offsetX - halfWidth + cornerCut, offsetY + halfHeight);
  graphics.lineTo(offsetX + halfWidth - cornerCut, offsetY + halfHeight);
  graphics.lineTo(offsetX + halfWidth, offsetY + halfHeight - cornerCut);
  graphics.lineTo(offsetX + halfWidth, offsetY - halfHeight + cornerCut);
  graphics.lineTo(offsetX + halfWidth - cornerCut, offsetY - halfHeight);
  graphics.lineTo(offsetX - halfWidth + cornerCut, offsetY - halfHeight);
  graphics.lineTo(offsetX - halfWidth, offsetY - halfHeight + cornerCut);
  graphics.lineTo(offsetX - halfWidth, offsetY + halfHeight - cornerCut);
  graphics.close();
  graphics.fill();
}

/** 绘制上缘偏心高光，增强分面金属感。 */
function drawTopHighlight(graphics: Graphics, color: Readonly<LobbyUiColor>): void {
  const style = LOBBY_START_BUTTON_STYLE;
  const halfWidth = style.width * 0.5;
  const top = style.height * 0.5 - BORDER_INSET - 2;
  graphics.fillColor = createLobbyUiColor(color);
  graphics.moveTo(-halfWidth + style.cornerCut + 5, top);
  graphics.lineTo(halfWidth - style.cornerCut - 14, top);
  graphics.lineTo(halfWidth - style.cornerCut - 23, top - TOP_HIGHLIGHT_HEIGHT);
  graphics.lineTo(-halfWidth + style.cornerCut + 14, top - TOP_HIGHLIGHT_HEIGHT);
  graphics.close();
  graphics.fill();
}

/** 绘制左右两枚青色楔形标记，让按钮更接近祭仪金属构件。 */
function drawSideMarkers(graphics: Graphics, color: Readonly<LobbyUiColor>): void {
  const style = LOBBY_START_BUTTON_STYLE;
  const halfWidth = style.width * 0.5;
  const markerCenter = halfWidth - style.cornerCut - 14;
  graphics.fillColor = createLobbyUiColor(color);
  drawMarker(graphics, -markerCenter, -1);
  drawMarker(graphics, markerCenter, 1);
}

/** 绘制朝向文字的单枚楔形标记。 */
function drawMarker(graphics: Graphics, centerX: number, direction: -1 | 1): void {
  const outerX = centerX + SIDE_MARKER_WIDTH * 0.5 * direction;
  const innerX = centerX - SIDE_MARKER_WIDTH * 0.5 * direction;
  graphics.moveTo(outerX, 8);
  graphics.lineTo(innerX, 0);
  graphics.lineTo(outerX, -8);
  graphics.lineTo(outerX - 4 * direction, 0);
  graphics.close();
  graphics.fill();
}
