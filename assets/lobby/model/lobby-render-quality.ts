import { MINIGAME } from 'cc/env';

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

/** Web 保留柔和高精度阴影，小游戏降低阴影采样与贴图带宽。 */
export const LOBBY_RENDER_QUALITY: LobbyRenderQuality = MINIGAME
  ? Object.freeze({
    shadowMapSize: 512,
    shadowFiltering: LobbyShadowFiltering.Hard,
  })
  : Object.freeze({
    shadowMapSize: 1024,
    shadowFiltering: LobbyShadowFiltering.Soft2X,
  });
