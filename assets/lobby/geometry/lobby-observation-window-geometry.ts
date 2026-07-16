import { type TriangleMeshWriter } from '../../core/geometry/triangle-mesh-writer';
import { LOBBY_LAYOUT } from '../model/lobby-layout';
import {
  appendLobbyTriangle,
  getLobbyGeometryJitter,
  type LobbyPoint3,
} from './lobby-triangle-geometry';

export const LOBBY_OBSERVATION_WINDOW_SEGMENTS = 32;
export const LOBBY_OBSERVATION_WALL_TRIANGLES = LOBBY_OBSERVATION_WINDOW_SEGMENTS * 4;
export const LOBBY_OBSERVATION_FRAME_TRIANGLES = LOBBY_OBSERVATION_WINDOW_SEGMENTS * 6;
export const LOBBY_OBSERVATION_GLASS_TRIANGLES = LOBBY_OBSERVATION_WINDOW_SEGMENTS;

enum ObservationWallBand {
  Opening,
  Relief,
  Boundary,
}

/** 写入直径严格等于墙高的圆形开口后墙。 */
export function writeLobbyObservationWall(writer: TriangleMeshWriter): void {
  for (let segment = 0; segment < LOBBY_OBSERVATION_WINDOW_SEGMENTS; segment++) {
    const opening0 = createObservationWallPoint(segment, ObservationWallBand.Opening);
    const opening1 = createObservationWallPoint(segment + 1, ObservationWallBand.Opening);
    const relief0 = createObservationWallPoint(segment, ObservationWallBand.Relief);
    const relief1 = createObservationWallPoint(segment + 1, ObservationWallBand.Relief);
    const boundary0 = createObservationWallPoint(segment, ObservationWallBand.Boundary);
    const boundary1 = createObservationWallPoint(segment + 1, ObservationWallBand.Boundary);

    appendLobbyTriangle(writer, opening0, relief0, relief1);
    appendLobbyTriangle(writer, opening0, relief1, opening1);
    appendLobbyTriangle(writer, relief0, boundary0, boundary1);
    appendLobbyTriangle(writer, relief0, boundary1, relief1);
  }
}

/** 写入嵌入后墙开口、同时覆盖洞口切面的厚重分面框。 */
export function writeLobbyObservationFrame(writer: TriangleMeshWriter): void {
  for (let segment = 0; segment < LOBBY_OBSERVATION_WINDOW_SEGMENTS; segment++) {
    const innerFront0 = createFramePoint(segment, false, true);
    const innerFront1 = createFramePoint(segment + 1, false, true);
    const outerFront0 = createFramePoint(segment, true, true);
    const outerFront1 = createFramePoint(segment + 1, true, true);
    const innerBack0 = createFramePoint(segment, false, false);
    const innerBack1 = createFramePoint(segment + 1, false, false);
    const outerBack0 = createFramePoint(segment, true, false);
    const outerBack1 = createFramePoint(segment + 1, true, false);

    appendLobbyTriangle(writer, innerFront0, outerFront0, outerFront1);
    appendLobbyTriangle(writer, innerFront0, outerFront1, innerFront1);
    appendLobbyTriangle(writer, outerFront0, outerBack0, outerBack1);
    appendLobbyTriangle(writer, outerFront0, outerBack1, outerFront1);
    appendLobbyTriangle(writer, innerFront0, innerFront1, innerBack1);
    appendLobbyTriangle(writer, innerFront0, innerBack1, innerBack0);
  }
}

/** 写入覆盖整个圆形开口的透明观察面。 */
export function writeLobbyObservationGlass(writer: TriangleMeshWriter): void {
  const center = {
    x: 0,
    y: LOBBY_LAYOUT.observationCenterY,
    z: LOBBY_LAYOUT.observationGlassZ,
  };
  for (let segment = 0; segment < LOBBY_OBSERVATION_WINDOW_SEGMENTS; segment++) {
    appendLobbyTriangle(
      writer,
      center,
      createGlassPoint(segment),
      createGlassPoint(segment + 1),
    );
  }
}

/** 生成圆形洞口、岩壁起伏层或矩形墙边界上的径向点。 */
function createObservationWallPoint(
  segment: number,
  band: ObservationWallBand,
): LobbyPoint3 {
  const normalized = normalizeSegment(segment);
  const angle = normalized / LOBBY_OBSERVATION_WINDOW_SEGMENTS * Math.PI * 2;
  const boundaryDistance = getWallBoundaryDistance(angle);
  const openingDistance = LOBBY_LAYOUT.observationRadius;
  const radialSpan = boundaryDistance - openingDistance;
  const distance = band === ObservationWallBand.Opening
    ? openingDistance
    : band === ObservationWallBand.Relief
      ? openingDistance + radialSpan * 0.54
      : boundaryDistance;
  const relief = band === ObservationWallBand.Relief && radialSpan > 0.0001
    ? 0.2 + getLobbyGeometryJitter(normalized, 3, 131, 0.16)
    : 0;
  return {
    x: Math.cos(angle) * distance,
    y: LOBBY_LAYOUT.observationCenterY + Math.sin(angle) * distance,
    z: LOBBY_LAYOUT.observationWallZ + relief,
  };
}

/** 计算从洞口中心沿指定方向到矩形后墙外边界的距离。 */
function getWallBoundaryDistance(angle: number): number {
  const cosine = Math.abs(Math.cos(angle));
  const sine = Math.abs(Math.sin(angle));
  const horizontalDistance = cosine <= 0.000001
    ? Number.POSITIVE_INFINITY
    : LOBBY_LAYOUT.hallHalfWidth / cosine;
  const verticalDistance = sine <= 0.000001
    ? Number.POSITIVE_INFINITY
    : (LOBBY_LAYOUT.hallHeight * 0.5) / sine;
  return Math.min(horizontalDistance, verticalDistance);
}

/** 生成观察窗框前后两层的内外轮廓点。 */
function createFramePoint(segment: number, outer: boolean, front: boolean): LobbyPoint3 {
  const normalized = normalizeSegment(segment);
  const angle = normalized / LOBBY_OBSERVATION_WINDOW_SEGMENTS * Math.PI * 2;
  const radius = outer
    ? LOBBY_LAYOUT.observationRadius + 0.43
      + getLobbyGeometryJitter(normalized, front ? 7 : 11, 137, 0.055)
    : LOBBY_LAYOUT.observationRadius;
  return {
    x: Math.cos(angle) * radius,
    y: LOBBY_LAYOUT.observationCenterY + Math.sin(angle) * radius,
    z: front ? LOBBY_LAYOUT.observationFrameFrontZ : LOBBY_LAYOUT.observationFrameBackZ,
  };
}

/** 生成透明观察面的圆周点。 */
function createGlassPoint(segment: number): LobbyPoint3 {
  const normalized = normalizeSegment(segment);
  const angle = normalized / LOBBY_OBSERVATION_WINDOW_SEGMENTS * Math.PI * 2;
  return {
    x: Math.cos(angle) * LOBBY_LAYOUT.observationRadius,
    y: LOBBY_LAYOUT.observationCenterY + Math.sin(angle) * LOBBY_LAYOUT.observationRadius,
    z: LOBBY_LAYOUT.observationGlassZ,
  };
}

/** 把任意圆周索引归一化到稳定分段范围。 */
function normalizeSegment(segment: number): number {
  return ((segment % LOBBY_OBSERVATION_WINDOW_SEGMENTS)
    + LOBBY_OBSERVATION_WINDOW_SEGMENTS) % LOBBY_OBSERVATION_WINDOW_SEGMENTS;
}
