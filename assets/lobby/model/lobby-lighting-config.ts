import { LOBBY_LAYOUT } from './lobby-layout';

/** 主射灯相对角色向相机侧前移的距离。 */
const KEY_LIGHT_FORWARD_OFFSET = 2.8;

/** 主射灯相对祭台顶面瞄准的躯干高度。 */
const KEY_LIGHT_TARGET_HEIGHT = 2.15;

/** 大厅主灯使用的字节 RGB 颜色。 */
export interface LobbyLightColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

export interface LobbySpotlightConfig {
  readonly nodeName: string;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly target: Readonly<{ x: number; y: number; z: number }>;
  readonly up: Readonly<{ x: number; y: number; z: number }>;
  readonly color: Readonly<LobbyLightColor>;
  readonly luminousFlux: number;
  readonly size: number;
  readonly range: number;
  readonly spotAngle: number;
  readonly angleAttenuationStrength: number;
  readonly shadowEnabled: boolean;
  readonly shadowBias: number;
  readonly shadowNormalBias: number;
}

/** 兼顾日光主体与轻微金色温度的大厅神圣主光。 */
export const LOBBY_KEY_LIGHT_COLOR: LobbyLightColor = Object.freeze({
  red: 255,
  green: 244,
  blue: 214,
});

/** 大厅唯一真实聚光灯的稳定配置。 */
export const LOBBY_KEY_LIGHT_CONFIG: LobbySpotlightConfig = Object.freeze({
  nodeName: 'MainSpotlight',
  position: Object.freeze({
    x: 0,
    y: LOBBY_LAYOUT.lightY,
    z: LOBBY_LAYOUT.focusZ + KEY_LIGHT_FORWARD_OFFSET,
  }),
  target: Object.freeze({
    x: 0,
    y: LOBBY_LAYOUT.altarTopY + KEY_LIGHT_TARGET_HEIGHT,
    z: LOBBY_LAYOUT.focusZ,
  }),
  up: Object.freeze({ x: 0, y: 0, z: 1 }),
  color: LOBBY_KEY_LIGHT_COLOR,
  luminousFlux: 9100,
  size: 0.15,
  range: 9.4,
  spotAngle: 45,
  angleAttenuationStrength: 0.59,
  shadowEnabled: false,
  shadowBias: 0.0001,
  shadowNormalBias: 0.01,
});
