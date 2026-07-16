import { type TriangleMeshWriter } from '../../core/geometry/triangle-mesh-writer';
import { LOBBY_LAYOUT } from '../model/lobby-layout';
import {
  LOBBY_ALTAR_SEGMENTS,
  LOBBY_ALTAR_TIERS,
  type LobbyAltarRing,
  type LobbyAltarTier,
} from './lobby-altar-layout';
import {
  appendLobbyTriangle,
  getLobbyGeometryJitter,
  type LobbyPoint3,
} from './lobby-triangle-geometry';

/** 写入两层带外凸肩部和不规则轮廓的低多边形祭台。 */
export function writeLobbyAltar(writer: TriangleMeshWriter): void {
  for (let tierIndex = 0; tierIndex < LOBBY_ALTAR_TIERS.length; tierIndex++) {
    const tier = getAltarTier(tierIndex);
    writeAltarTierSides(writer, tier, tierIndex);
    writeAltarTierTop(writer, tier, tierIndex);
  }
}

/** 写入一层祭台相邻轮廓圈之间的分面侧壁。 */
function writeAltarTierSides(
  writer: TriangleMeshWriter,
  tier: Readonly<LobbyAltarTier>,
  tierIndex: number,
): void {
  for (let ringIndex = 0; ringIndex < tier.rings.length - 1; ringIndex++) {
    for (let segment = 0; segment < LOBBY_ALTAR_SEGMENTS; segment++) {
      const lower0 = createAltarPoint(tier, tierIndex, ringIndex, segment);
      const lower1 = createAltarPoint(tier, tierIndex, ringIndex, segment + 1);
      const upper0 = createAltarPoint(tier, tierIndex, ringIndex + 1, segment);
      const upper1 = createAltarPoint(tier, tierIndex, ringIndex + 1, segment + 1);
      appendLobbyTriangle(writer, lower0, upper1, lower1);
      appendLobbyTriangle(writer, lower0, upper0, upper1);
    }
  }
}

/** 写入一层祭台朝上的不规则顶面。 */
function writeAltarTierTop(
  writer: TriangleMeshWriter,
  tier: Readonly<LobbyAltarTier>,
  tierIndex: number,
): void {
  const topRingIndex = tier.rings.length - 1;
  const topRing = getAltarRing(tier, topRingIndex);
  const center = { x: 0, y: topRing.y, z: LOBBY_LAYOUT.focusZ };
  for (let segment = 0; segment < LOBBY_ALTAR_SEGMENTS; segment++) {
    appendLobbyTriangle(
      writer,
      center,
      createAltarPoint(tier, tierIndex, topRingIndex, segment + 1),
      createAltarPoint(tier, tierIndex, topRingIndex, segment),
    );
  }
}

/** 根据固定轮廓与确定性扰动计算祭台顶点。 */
function createAltarPoint(
  tier: Readonly<LobbyAltarTier>,
  tierIndex: number,
  ringIndex: number,
  segment: number,
): LobbyPoint3 {
  const ring = getAltarRing(tier, ringIndex);
  const normalizedSegment = segment % LOBBY_ALTAR_SEGMENTS;
  const angle = normalizedSegment / LOBBY_ALTAR_SEGMENTS * Math.PI * 2
    + getLobbyGeometryJitter(normalizedSegment, tierIndex, 127, 0.035);
  const radius = ring.radius + getLobbyGeometryJitter(
    normalizedSegment,
    tierIndex,
    131 + ringIndex,
    ring.radiusJitter,
  );
  return {
    x: Math.cos(angle) * radius,
    y: ring.y,
    z: LOBBY_LAYOUT.focusZ + Math.sin(angle) * radius,
  };
}

/** 获取由固定层级清单保证存在的祭台层。 */
function getAltarTier(tierIndex: number): Readonly<LobbyAltarTier> {
  const tier = LOBBY_ALTAR_TIERS[tierIndex];
  if (tier === undefined) {
    throw new Error('祭台层级索引越界。');
  }
  return tier;
}

/** 获取由固定轮廓清单保证存在的祭台圈。 */
function getAltarRing(
  tier: Readonly<LobbyAltarTier>,
  ringIndex: number,
): Readonly<LobbyAltarRing> {
  const ring = tier.rings[ringIndex];
  if (ring === undefined) {
    throw new Error('祭台轮廓圈索引越界。');
  }
  return ring;
}
