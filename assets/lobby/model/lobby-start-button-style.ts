import { LOBBY_VANGUARD_OPTIONS } from './lobby-vanguard-options';

/** 大厅开始按钮可切换的视觉状态。 */
export enum LobbyStartButtonVisualState {
  Idle = 'idle',
  Hovered = 'hovered',
  Pressed = 'pressed',
}

/** 不依赖 Cocos 实例的字节 RGBA 颜色。 */
export interface LobbyUiColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

/** 开始按钮在单一交互状态下使用的完整配色。 */
export interface LobbyStartButtonPalette {
  readonly shadow: Readonly<LobbyUiColor>;
  readonly border: Readonly<LobbyUiColor>;
  readonly surface: Readonly<LobbyUiColor>;
  readonly innerFacet: Readonly<LobbyUiColor>;
  readonly accent: Readonly<LobbyUiColor>;
  readonly text: Readonly<LobbyUiColor>;
  readonly textOutline: Readonly<LobbyUiColor>;
}

/** 大厅开始按钮的固定尺寸、玩家锚点和状态色板。 */
export interface LobbyStartButtonStyle {
  readonly width: number;
  readonly height: number;
  readonly cornerCut: number;
  readonly shadowOffsetY: number;
  readonly screenOffsetY: number;
  readonly labelFontSize: number;
  readonly labelSpacing: number;
  readonly worldAnchor: Readonly<{ x: number; y: number; z: number }>;
  readonly palettes: Readonly<Record<LobbyStartButtonVisualState, LobbyStartButtonPalette>>;
}

/** 冷青铜面板与暖象牙文字让按钮脱离大厅既有的黑红配色。 */
export const LOBBY_START_BUTTON_STYLE: LobbyStartButtonStyle = Object.freeze({
  width: 294,
  height: 78,
  cornerCut: 15,
  shadowOffsetY: -7,
  screenOffsetY: -126,
  labelFontSize: 29,
  labelSpacing: 5,
  worldAnchor: Object.freeze({
    x: LOBBY_VANGUARD_OPTIONS.position.x,
    y: LOBBY_VANGUARD_OPTIONS.position.y,
    z: LOBBY_VANGUARD_OPTIONS.position.z,
  }),
  palettes: Object.freeze({
    [LobbyStartButtonVisualState.Idle]: createPalette(
      createColor(12, 53, 58, 172),
      createColor(198, 168, 91, 255),
      createColor(32, 91, 96, 250),
      createColor(47, 122, 121, 230),
      createColor(137, 217, 204, 255),
      createColor(249, 239, 210, 255),
      createColor(15, 63, 66, 255),
    ),
    [LobbyStartButtonVisualState.Hovered]: createPalette(
      createColor(14, 61, 64, 184),
      createColor(222, 191, 108, 255),
      createColor(41, 116, 117, 252),
      createColor(63, 151, 143, 236),
      createColor(190, 239, 220, 255),
      createColor(255, 247, 220, 255),
      createColor(18, 71, 72, 255),
    ),
    [LobbyStartButtonVisualState.Pressed]: createPalette(
      createColor(10, 45, 50, 186),
      createColor(226, 195, 116, 255),
      createColor(25, 75, 81, 255),
      createColor(38, 104, 105, 238),
      createColor(116, 198, 190, 255),
      createColor(255, 245, 217, 255),
      createColor(12, 55, 59, 255),
    ),
  }),
});

/** 创建冻结后的交互状态色板。 */
function createPalette(
  shadow: Readonly<LobbyUiColor>,
  border: Readonly<LobbyUiColor>,
  surface: Readonly<LobbyUiColor>,
  innerFacet: Readonly<LobbyUiColor>,
  accent: Readonly<LobbyUiColor>,
  text: Readonly<LobbyUiColor>,
  textOutline: Readonly<LobbyUiColor>,
): LobbyStartButtonPalette {
  return Object.freeze({
    shadow,
    border,
    surface,
    innerFacet,
    accent,
    text,
    textOutline,
  });
}

/** 创建冻结后的字节 RGBA 颜色。 */
function createColor(
  red: number,
  green: number,
  blue: number,
  alpha: number,
): LobbyUiColor {
  return Object.freeze({ red, green, blue, alpha });
}
