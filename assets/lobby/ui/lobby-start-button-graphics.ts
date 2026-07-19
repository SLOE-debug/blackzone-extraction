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

type GlyphSegment = readonly [
  startX: number,
  startY: number,
  endX: number,
  endY: number,
];

/** “开始游戏”四字的低密度单线矢量骨架。 */
const START_BUTTON_GLYPHS: readonly (readonly GlyphSegment[])[] = Object.freeze([
  Object.freeze([
    [-0.48, 0.42, 0.48, 0.42],
    [-0.52, 0.03, 0.52, 0.03],
    [-0.27, 0.42, -0.27, -0.48],
    [0.27, 0.42, 0.27, -0.48],
  ]),
  Object.freeze([
    [-0.36, 0.45, -0.48, -0.12],
    [-0.48, -0.12, -0.08, -0.03],
    [-0.3, 0.25, -0.05, -0.48],
    [-0.5, -0.43, -0.02, 0.1],
    [0.08, 0.13, 0.45, 0.13],
    [0.2, 0.45, 0.05, 0.13],
    [0.05, 0.13, 0.32, 0.34],
    [0.05, -0.08, 0.46, -0.08],
    [0.05, -0.08, 0.05, -0.45],
    [0.05, -0.45, 0.46, -0.45],
    [0.46, -0.45, 0.46, -0.08],
  ]),
  Object.freeze([
    [-0.5, 0.37, -0.35, 0.25],
    [-0.5, 0.08, -0.35, -0.02],
    [-0.49, -0.45, -0.31, -0.13],
    [-0.18, 0.37, 0.45, 0.37],
    [-0.08, 0.48, -0.18, 0.37],
    [0.18, 0.48, 0.08, 0.37],
    [-0.11, 0.16, 0.37, 0.16],
    [-0.03, 0.16, -0.03, -0.45],
    [0.28, 0.16, 0.28, -0.45],
    [-0.03, -0.14, 0.28, -0.14],
    [-0.03, -0.45, 0.28, -0.45],
    [0.39, 0.05, 0.48, -0.18],
  ]),
  Object.freeze([
    [-0.48, 0.36, -0.05, 0.36],
    [-0.05, 0.36, -0.16, -0.08],
    [-0.16, -0.08, -0.48, -0.45],
    [-0.46, 0.08, -0.06, -0.43],
    [0.08, 0.48, 0.34, -0.42],
    [0.03, 0.19, 0.48, 0.19],
    [0.35, 0.43, 0.48, 0.31],
    [0.08, -0.46, 0.46, 0.02],
  ]),
]);

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
  drawStartButtonText(graphics, palette);
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

/** 在底板同一 Graphics 中描绘矢量文字，避免 Label 产生独立 UI Draw Call。 */
function drawStartButtonText(
  graphics: Graphics,
  palette: Readonly<LobbyStartButtonPalette>,
): void {
  const style = LOBBY_START_BUTTON_STYLE;
  const glyphHeight = style.labelFontSize;
  const glyphWidth = glyphHeight * 0.78;
  const advance = glyphWidth + style.labelSpacing;
  const firstCenterX = -advance * (START_BUTTON_GLYPHS.length - 1) * 0.5;
  graphics.strokeColor = createLobbyUiColor(palette.textOutline);
  graphics.lineWidth = 6;
  appendGlyphPaths(graphics, firstCenterX, glyphWidth, glyphHeight, advance);
  graphics.stroke();
  graphics.strokeColor = createLobbyUiColor(palette.text);
  graphics.lineWidth = 3;
  appendGlyphPaths(graphics, firstCenterX, glyphWidth, glyphHeight, advance);
  graphics.stroke();
}

function appendGlyphPaths(
  graphics: Graphics,
  firstCenterX: number,
  glyphWidth: number,
  glyphHeight: number,
  advance: number,
): void {
  for (let glyphIndex = 0; glyphIndex < START_BUTTON_GLYPHS.length; glyphIndex++) {
    const glyph = START_BUTTON_GLYPHS[glyphIndex];
    if (glyph === undefined) {
      throw new Error('大厅开始按钮矢量字形不存在。');
    }
    const centerX = firstCenterX + glyphIndex * advance;
    for (const segment of glyph) {
      graphics.moveTo(
        centerX + segment[0] * glyphWidth,
        segment[1] * glyphHeight,
      );
      graphics.lineTo(
        centerX + segment[2] * glyphWidth,
        segment[3] * glyphHeight,
      );
    }
  }
}
