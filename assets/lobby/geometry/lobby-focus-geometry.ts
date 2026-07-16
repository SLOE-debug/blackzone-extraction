import { type TriangleMeshWriter } from '../../core/geometry/triangle-mesh-writer';
import { LOBBY_LAYOUT } from '../model/lobby-layout';
import {
  appendLobbyTriangle,
  getLobbyGeometryJitter,
  type LobbyPoint3,
} from './lobby-triangle-geometry';

const CHARACTER_SEGMENTS = 8;
const CABLE_SEGMENTS = 6;
const LAMP_SEGMENTS = 16;

interface CrossSectionPoint {
  readonly x: number;
  readonly z: number;
}

const CHARACTER_CROSS_SECTION: readonly CrossSectionPoint[] = Object.freeze([
  Object.freeze({ x: -0.38, z: -0.27 }),
  Object.freeze({ x: 0.38, z: -0.27 }),
  Object.freeze({ x: 0.5, z: -0.13 }),
  Object.freeze({ x: 0.48, z: 0.13 }),
  Object.freeze({ x: 0.34, z: 0.27 }),
  Object.freeze({ x: -0.36, z: 0.27 }),
  Object.freeze({ x: -0.49, z: 0.12 }),
  Object.freeze({ x: -0.5, z: -0.12 }),
]);

const CHARACTER_LEVELS = Object.freeze([
  Object.freeze({
    y: LOBBY_LAYOUT.altarTopY + 0.03,
    scale: 0.92,
    offsetX: -0.03,
    offsetZ: 0.02,
  }),
  Object.freeze({
    y: LOBBY_LAYOUT.altarTopY + 1.76,
    scale: 1,
    offsetX: 0,
    offsetZ: 0,
  }),
  Object.freeze({
    y: LOBBY_LAYOUT.altarTopY + 3.45,
    scale: 0.84,
    offsetX: 0.08,
    offsetZ: -0.035,
  }),
]);

const CABLE_LEVELS = Object.freeze([
  Object.freeze({ y: LOBBY_LAYOUT.cableTopY, x: 0, z: 0 }),
  Object.freeze({
    y: (LOBBY_LAYOUT.cableTopY + LOBBY_LAYOUT.lampTopY) * 0.5,
    x: 0.018,
    z: -0.012,
  }),
  Object.freeze({ y: LOBBY_LAYOUT.lampTopY, x: 0, z: 0 }),
]);

/** 写入带不对称偏移和倒角截面的细长角色占位体。 */
export function writeLobbyCharacter(writer: TriangleMeshWriter): void {
  for (let level = 0; level < CHARACTER_LEVELS.length - 1; level++) {
    for (let segment = 0; segment < CHARACTER_SEGMENTS; segment++) {
      const lower0 = createCharacterPoint(level, segment);
      const lower1 = createCharacterPoint(level, segment + 1);
      const upper0 = createCharacterPoint(level + 1, segment);
      const upper1 = createCharacterPoint(level + 1, segment + 1);
      appendLobbyTriangle(writer, lower0, upper0, upper1);
      appendLobbyTriangle(writer, lower0, upper1, lower1);
    }
  }

  const bottomCenter = createCharacterCenter(0);
  const topCenter = createCharacterCenter(CHARACTER_LEVELS.length - 1);
  for (let segment = 0; segment < CHARACTER_SEGMENTS; segment++) {
    appendLobbyTriangle(
      writer,
      bottomCenter,
      createCharacterPoint(0, segment),
      createCharacterPoint(0, segment + 1),
    );
    appendLobbyTriangle(
      writer,
      topCenter,
      createCharacterPoint(CHARACTER_LEVELS.length - 1, segment + 1),
      createCharacterPoint(CHARACTER_LEVELS.length - 1, segment),
    );
  }
}

/** 写入从天花板垂落到灯具的低面数电线。 */
export function writeLobbyLampCable(writer: TriangleMeshWriter): void {
  for (let level = 0; level < CABLE_LEVELS.length - 1; level++) {
    for (let segment = 0; segment < CABLE_SEGMENTS; segment++) {
      const top0 = createCablePoint(level, segment);
      const top1 = createCablePoint(level, segment + 1);
      const bottom0 = createCablePoint(level + 1, segment);
      const bottom1 = createCablePoint(level + 1, segment + 1);
      appendLobbyTriangle(writer, top0, bottom1, bottom0);
      appendLobbyTriangle(writer, top0, top1, bottom1);
    }
  }
}

/** 写入由上下两圈切面组成的低面数吸顶灯外壳。 */
export function writeLobbyLampHousing(writer: TriangleMeshWriter): void {
  const topCenter = { x: 0, y: LOBBY_LAYOUT.lampTopY, z: LOBBY_LAYOUT.focusZ };
  const bottomCenter = { x: 0, y: LOBBY_LAYOUT.lampBottomY, z: LOBBY_LAYOUT.focusZ };
  for (let segment = 0; segment < LAMP_SEGMENTS; segment++) {
    const bottom0 = createLampPoint(segment, false);
    const bottom1 = createLampPoint(segment + 1, false);
    const top0 = createLampPoint(segment, true);
    const top1 = createLampPoint(segment + 1, true);
    appendLobbyTriangle(writer, bottom0, top0, top1);
    appendLobbyTriangle(writer, bottom0, top1, bottom1);
    appendLobbyTriangle(writer, topCenter, top1, top0);
    appendLobbyTriangle(writer, bottomCenter, bottom0, bottom1);
  }
}

/** 写入朝下的象牙金日光分面发光圆盘。 */
export function writeLobbyLampGlow(writer: TriangleMeshWriter): void {
  const center = { x: 0, y: LOBBY_LAYOUT.lampGlowY, z: LOBBY_LAYOUT.focusZ };
  for (let segment = 0; segment < LAMP_SEGMENTS; segment++) {
    appendLobbyTriangle(
      writer,
      center,
      createLampGlowPoint(segment),
      createLampGlowPoint(segment + 1),
    );
  }
}

/** 生成角色指定高度和截面索引处的偏斜顶点。 */
function createCharacterPoint(levelIndex: number, segment: number): LobbyPoint3 {
  const level = CHARACTER_LEVELS[levelIndex];
  const crossSection = CHARACTER_CROSS_SECTION[segment % CHARACTER_SEGMENTS];
  if (level === undefined || crossSection === undefined) {
    throw new Error('角色占位体截面索引无效。');
  }
  return {
    x: crossSection.x * level.scale + level.offsetX,
    y: level.y,
    z: LOBBY_LAYOUT.focusZ + crossSection.z * level.scale + level.offsetZ,
  };
}

/** 生成角色上下封口的中心点。 */
function createCharacterCenter(levelIndex: number): LobbyPoint3 {
  const level = CHARACTER_LEVELS[levelIndex];
  if (level === undefined) {
    throw new Error('角色占位体高度索引无效。');
  }
  return {
    x: level.offsetX,
    y: level.y,
    z: LOBBY_LAYOUT.focusZ + level.offsetZ,
  };
}

/** 生成电线指定高度圈层的六边形截面顶点。 */
function createCablePoint(levelIndex: number, segment: number): LobbyPoint3 {
  const level = CABLE_LEVELS[levelIndex];
  if (level === undefined) {
    throw new Error('大厅电线高度索引无效。');
  }
  const normalized = segment % CABLE_SEGMENTS;
  const angle = normalized / CABLE_SEGMENTS * Math.PI * 2;
  const radius = 0.045;
  return {
    x: level.x + Math.cos(angle) * radius,
    y: level.y,
    z: LOBBY_LAYOUT.focusZ + level.z + Math.sin(angle) * radius,
  };
}

/** 生成灯具外壳的上下轮廓点。 */
function createLampPoint(segment: number, top: boolean): LobbyPoint3 {
  const normalized = segment % LAMP_SEGMENTS;
  const angle = normalized / LAMP_SEGMENTS * Math.PI * 2;
  const radius = (top ? 0.82 : 0.67)
    + getLobbyGeometryJitter(normalized, top ? 0 : 1, 101, 0.035);
  return {
    x: Math.cos(angle) * radius,
    y: top ? LOBBY_LAYOUT.lampTopY : LOBBY_LAYOUT.lampBottomY,
    z: LOBBY_LAYOUT.focusZ + Math.sin(angle) * radius,
  };
}

/** 生成灯具下方发光面的轮廓点。 */
function createLampGlowPoint(segment: number): LobbyPoint3 {
  const normalized = segment % LAMP_SEGMENTS;
  const angle = normalized / LAMP_SEGMENTS * Math.PI * 2;
  const radius = 0.57 + getLobbyGeometryJitter(normalized, 0, 107, 0.018);
  return {
    x: Math.cos(angle) * radius,
    y: LOBBY_LAYOUT.lampGlowY,
    z: LOBBY_LAYOUT.focusZ + Math.sin(angle) * radius,
  };
}
