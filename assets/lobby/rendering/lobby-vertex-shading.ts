import { type SurfaceBufferGeometry } from '../../core/geometry/buffer-geometry';
import {
  LobbyOpaqueSection,
  type LobbyOpaqueSectionRanges,
  type LobbyVertexRange,
} from '../geometry/lobby-geometry-topology';

const BYTE_COLOR_SCALE = 1 / 255;

const OPAQUE_SECTION_ORDER: readonly LobbyOpaqueSection[] = Object.freeze([
  LobbyOpaqueSection.Floor,
  LobbyOpaqueSection.Ceiling,
  LobbyOpaqueSection.BackWall,
  LobbyOpaqueSection.FrontWall,
  LobbyOpaqueSection.SideWalls,
  LobbyOpaqueSection.CircularPanel,
  LobbyOpaqueSection.CircularFrame,
  LobbyOpaqueSection.Character,
  LobbyOpaqueSection.LampCable,
  LobbyOpaqueSection.LampHousing,
]);

interface LobbySurfaceProfile {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

const SECTION_PROFILES = {
  [LobbyOpaqueSection.Floor]: createSurfaceProfile(102, 12, 25),
  [LobbyOpaqueSection.Ceiling]: createSurfaceProfile(48, 5, 14),
  [LobbyOpaqueSection.BackWall]: createSurfaceProfile(70, 8, 20),
  [LobbyOpaqueSection.FrontWall]: createSurfaceProfile(60, 7, 18),
  [LobbyOpaqueSection.SideWalls]: createSurfaceProfile(82, 9, 22),
  [LobbyOpaqueSection.CircularPanel]: createSurfaceProfile(30, 3, 10),
  [LobbyOpaqueSection.CircularFrame]: createSurfaceProfile(175, 32, 46),
  [LobbyOpaqueSection.Character]: createSurfaceProfile(190, 86, 78),
  [LobbyOpaqueSection.LampCable]: createSurfaceProfile(92, 35, 34),
  [LobbyOpaqueSection.LampHousing]: createSurfaceProfile(96, 14, 26),
} satisfies Record<LobbyOpaqueSection, LobbySurfaceProfile>;

/** 把暗红分区色写入供内置 Standard 使用的大厅顶点流。 */
export class LobbyVertexShading {
  /** 按稳定区段刷新大厅全部不透明表面颜色。 */
  public update(
    geometry: SurfaceBufferGeometry,
    ranges: LobbyOpaqueSectionRanges,
  ): void {
    for (const section of OPAQUE_SECTION_ORDER) {
      shadeOpaqueSection(geometry, ranges[section], SECTION_PROFILES[section], section);
    }
  }
}

/** 为独立灯具发光面写入稳定的暖白顶点色。 */
export class LobbyGlowVertexShading {
  /** 原地刷新暖白发光颜色。 */
  public update(geometry: SurfaceBufferGeometry): void {
    const { colors } = geometry;
    for (let vertex = 0; vertex < geometry.vertexCount; vertex++) {
      const colorOffset = vertex * 4;
      colors[colorOffset] = 1;
      colors[colorOffset + 1] = 0.86;
      colors[colorOffset + 2] = 0.65;
      colors[colorOffset + 3] = 1;
    }
  }
}

/** 根据表面法线和材质区段计算单个表面范围。 */
function shadeOpaqueSection(
  geometry: SurfaceBufferGeometry,
  range: Readonly<LobbyVertexRange>,
  profile: Readonly<LobbySurfaceProfile>,
  section: LobbyOpaqueSection,
): void {
  const endVertex = range.startVertex + range.vertexCount;
  const { normals, colors } = geometry;
  for (let vertex = range.startVertex; vertex < endVertex; vertex++) {
    const positionOffset = vertex * 3;
    const normalX = normals[positionOffset] ?? 0;
    const normalY = normals[positionOffset + 1] ?? 0;
    const normalZ = normals[positionOffset + 2] ?? 0;
    const shade = getSectionShade(section, normalX, normalY, normalZ);
    const colorOffset = vertex * 4;
    colors[colorOffset] = Math.min(1, profile.red * shade);
    colors[colorOffset + 1] = Math.min(1, profile.green * shade);
    colors[colorOffset + 2] = Math.min(1, profile.blue * shade);
    colors[colorOffset + 3] = 1;
  }
}

/** 计算不会替代实时 SpotLight 的轻微分面色差。 */
function getSectionShade(
  section: LobbyOpaqueSection,
  normalX: number,
  normalY: number,
  normalZ: number,
): number {
  const facet = 0.86
    + Math.max(0, normalY) * 0.08
    + Math.max(0, normalZ) * 0.035
    + Math.max(0, -normalX) * 0.02;
  if (section === LobbyOpaqueSection.CircularPanel) {
    return facet * 0.7;
  }
  if (section === LobbyOpaqueSection.Character) {
    return Math.min(1, facet * 1.08);
  }
  return Math.min(1, facet);
}

/** 创建归一化暗红颜色配置。 */
function createSurfaceProfile(
  red: number,
  green: number,
  blue: number,
): LobbySurfaceProfile {
  return Object.freeze({
    red: red * BYTE_COLOR_SCALE,
    green: green * BYTE_COLOR_SCALE,
    blue: blue * BYTE_COLOR_SCALE,
  });
}

export const lobbyVertexShading = new LobbyVertexShading();
export const lobbyGlowVertexShading = new LobbyGlowVertexShading();
