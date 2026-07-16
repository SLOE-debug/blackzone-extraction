import { type TriangleMeshWriter } from '../../core/geometry/triangle-mesh-writer';
import {
  LOBBY_RITUAL_LAMP_POSITIONS,
  LOBBY_RITUAL_LAMP_SEGMENTS,
  type LobbyRitualLampPosition,
} from './lobby-ritual-lamp-layout';
import { appendLobbyTriangle, type LobbyPoint3 } from './lobby-triangle-geometry';

const HOUSING_LEVELS = Object.freeze([
  Object.freeze({ y: 0.02, radius: 0.2 }),
  Object.freeze({ y: 0.13, radius: 0.24 }),
  Object.freeze({ y: 0.24, radius: 0.14 }),
]);

/** 写入围绕祭台的小型六边形灯座。 */
export function writeLobbyRitualLampHousings(writer: TriangleMeshWriter): void {
  for (const position of LOBBY_RITUAL_LAMP_POSITIONS) {
    for (let levelIndex = 0; levelIndex < HOUSING_LEVELS.length - 1; levelIndex++) {
      for (let segment = 0; segment < LOBBY_RITUAL_LAMP_SEGMENTS; segment++) {
        const lower0 = createHousingPoint(position, levelIndex, segment);
        const lower1 = createHousingPoint(position, levelIndex, segment + 1);
        const upper0 = createHousingPoint(position, levelIndex + 1, segment);
        const upper1 = createHousingPoint(position, levelIndex + 1, segment + 1);
        appendLobbyTriangle(writer, lower0, upper1, lower1);
        appendLobbyTriangle(writer, lower0, upper0, upper1);
      }
    }

    const topLevelIndex = HOUSING_LEVELS.length - 1;
    const topLevel = getHousingLevel(topLevelIndex);
    const center = { x: position.x, y: topLevel.y, z: position.z };
    for (let segment = 0; segment < LOBBY_RITUAL_LAMP_SEGMENTS; segment++) {
      appendLobbyTriangle(
        writer,
        center,
        createHousingPoint(position, topLevelIndex, segment + 1),
        createHousingPoint(position, topLevelIndex, segment),
      );
    }
  }
}

/** 写入不参与实时照明的暗红晶体发光面。 */
export function writeLobbyRitualLampGlow(writer: TriangleMeshWriter): void {
  for (const position of LOBBY_RITUAL_LAMP_POSITIONS) {
    const bottom = { x: position.x, y: 0.22, z: position.z };
    const top = { x: position.x, y: 0.62, z: position.z };
    for (let segment = 0; segment < LOBBY_RITUAL_LAMP_SEGMENTS; segment++) {
      const ring0 = createGlowRingPoint(position, segment);
      const ring1 = createGlowRingPoint(position, segment + 1);
      appendLobbyTriangle(writer, bottom, ring1, ring0);
      appendLobbyTriangle(writer, top, ring0, ring1);
    }
  }
}

/** 生成灯座指定高度圈层的轮廓点。 */
function createHousingPoint(
  position: Readonly<LobbyRitualLampPosition>,
  levelIndex: number,
  segment: number,
): LobbyPoint3 {
  const level = getHousingLevel(levelIndex);
  const angle = normalizeSegment(segment) / LOBBY_RITUAL_LAMP_SEGMENTS * Math.PI * 2;
  return {
    x: position.x + Math.cos(angle) * level.radius,
    y: level.y,
    z: position.z + Math.sin(angle) * level.radius,
  };
}

/** 生成晶体中部六边形轮廓点。 */
function createGlowRingPoint(
  position: Readonly<LobbyRitualLampPosition>,
  segment: number,
): LobbyPoint3 {
  const angle = normalizeSegment(segment) / LOBBY_RITUAL_LAMP_SEGMENTS * Math.PI * 2;
  return {
    x: position.x + Math.cos(angle) * 0.13,
    y: 0.42,
    z: position.z + Math.sin(angle) * 0.13,
  };
}

/** 获取由固定清单保证存在的灯座圈层。 */
function getHousingLevel(levelIndex: number): Readonly<{ y: number; radius: number }> {
  const level = HOUSING_LEVELS[levelIndex];
  if (level === undefined) {
    throw new Error('祭台灯座圈层索引越界。');
  }
  return level;
}

/** 把闭合轮廓索引映射到有效段号。 */
function normalizeSegment(segment: number): number {
  return segment % LOBBY_RITUAL_LAMP_SEGMENTS;
}
