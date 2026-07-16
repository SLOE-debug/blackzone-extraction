import { LOBBY_LAYOUT } from './lobby-layout';

export interface LobbySpotlightConfig {
  readonly nodeName: string;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly target: Readonly<{ x: number; y: number; z: number }>;
  readonly up: Readonly<{ x: number; y: number; z: number }>;
  readonly color: Readonly<{ red: number; green: number; blue: number }>;
  readonly luminousFlux: number;
  readonly size: number;
  readonly range: number;
  readonly spotAngle: number;
  readonly angleAttenuationStrength: number;
  readonly shadowEnabled: boolean;
  readonly shadowBias: number;
  readonly shadowNormalBias: number;
}

/** 大厅唯一真实聚光灯的稳定配置。 */
export const LOBBY_KEY_LIGHT_CONFIG: LobbySpotlightConfig = Object.freeze({
  nodeName: 'MainSpotlight',
  position: Object.freeze({ x: 0, y: LOBBY_LAYOUT.lightY, z: LOBBY_LAYOUT.focusZ }),
  target: Object.freeze({
    x: 0,
    y: LOBBY_LAYOUT.altarTopY + 0.05,
    z: LOBBY_LAYOUT.focusZ,
  }),
  up: Object.freeze({ x: 0, y: 0, z: 1 }),
  color: Object.freeze({ red: 255, green: 224, blue: 184 }),
  luminousFlux: 9100,
  size: 0.15,
  range: 9.4,
  spotAngle: 45,
  angleAttenuationStrength: 0.59,
  shadowEnabled: true,
  shadowBias: 0.0001,
  shadowNormalBias: 0.01,
});
