import { HTML5, MINIGAME } from 'cc/env';

/** 大厅阴影滤波等级。 */
export enum LobbyShadowFiltering {
  Hard = 'hard',
  Soft2X = 'soft-2x',
}

/** 不同运行平台使用的真实灯光质量参数。 */
export interface LobbyRenderQuality {
  readonly shadowMapSize: number;
  readonly shadowFiltering: LobbyShadowFiltering;
}

/** 小游戏使用的低带宽阴影配置。 */
const MINI_GAME_RENDER_QUALITY = Object.freeze({
  shadowMapSize: 512,
  shadowFiltering: LobbyShadowFiltering.Hard,
}) satisfies LobbyRenderQuality;

/** Web 避免软阴影采样与高分辨率 ShadowMap 持续挤占低端 GPU。 */
const WEB_RENDER_QUALITY = Object.freeze({
  shadowMapSize: 512,
  shadowFiltering: LobbyShadowFiltering.Hard,
}) satisfies LobbyRenderQuality;

/** 原生平台保留柔和高精度阴影。 */
const NATIVE_RENDER_QUALITY = Object.freeze({
  shadowMapSize: 1024,
  shadowFiltering: LobbyShadowFiltering.Soft2X,
}) satisfies LobbyRenderQuality;

/** 当前平台实际使用的大厅真实灯光质量参数。 */
export const LOBBY_RENDER_QUALITY: LobbyRenderQuality = MINIGAME
  ? MINI_GAME_RENDER_QUALITY
  : HTML5 ? WEB_RENDER_QUALITY : NATIVE_RENDER_QUALITY;
