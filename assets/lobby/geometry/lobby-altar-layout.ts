import { LOBBY_LAYOUT } from '../model/lobby-layout';

/** 祭台单圈轮廓的高度、半径与固定扰动幅度。 */
export interface LobbyAltarRing {
  readonly y: number;
  readonly radius: number;
  readonly radiusJitter: number;
}

/** 由底圈、外凸肩圈和顶圈组成的一层祭台。 */
export interface LobbyAltarTier {
  readonly rings: readonly LobbyAltarRing[];
}

/** 每层祭台使用的低多边形轮廓段数。 */
export const LOBBY_ALTAR_SEGMENTS = 14;

/** 两层祭台的固定轮廓，刷新时不会重新随机。 */
export const LOBBY_ALTAR_TIERS: readonly LobbyAltarTier[] = Object.freeze([
  createTier([
    createRing(0.02, 3.22, 0.14),
    createRing(0.24, 3.38, 0.18),
    createRing(0.38, 3.02, 0.15),
  ]),
  createTier([
    createRing(0.38, 2.18, 0.11),
    createRing(0.56, 2.34, 0.14),
    createRing(LOBBY_LAYOUT.altarTopY, 2.02, 0.12),
  ]),
]);

/** 祭台侧面与顶面合计的固定三角形数量。 */
export const LOBBY_ALTAR_TRIANGLE_COUNT = LOBBY_ALTAR_TIERS.reduce(
  (triangleCount, tier) => triangleCount
    + (tier.rings.length - 1) * LOBBY_ALTAR_SEGMENTS * 2
    + LOBBY_ALTAR_SEGMENTS,
  0,
);

/** 创建冻结后的祭台层级。 */
function createTier(rings: readonly LobbyAltarRing[]): LobbyAltarTier {
  return Object.freeze({ rings: Object.freeze(rings) });
}

/** 创建冻结后的祭台轮廓圈。 */
function createRing(y: number, radius: number, radiusJitter: number): LobbyAltarRing {
  return Object.freeze({ y, radius, radiusJitter });
}
