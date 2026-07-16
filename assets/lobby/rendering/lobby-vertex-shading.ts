import { type SurfaceBufferGeometry } from '../../core/geometry/buffer-geometry';
import {
  LOBBY_OPAQUE_SECTION_ORDER,
  LobbyOpaqueSection,
  type LobbyOpaqueSectionRanges,
} from '../geometry/lobby-geometry-topology';

const BYTE_COLOR_SCALE = 1 / 255;

interface LobbySurfaceProfile {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

const SECTION_PROFILES = {
  [LobbyOpaqueSection.Floor]: createSurfaceProfile(102, 12, 25),
  [LobbyOpaqueSection.FloorCracks]: createSurfaceProfile(12, 1, 3),
  [LobbyOpaqueSection.Ceiling]: createSurfaceProfile(48, 5, 14),
  [LobbyOpaqueSection.BackWall]: createSurfaceProfile(70, 8, 20),
  [LobbyOpaqueSection.FrontWall]: createSurfaceProfile(60, 7, 18),
  [LobbyOpaqueSection.SideWalls]: createSurfaceProfile(82, 9, 22),
  [LobbyOpaqueSection.Altar]: createSurfaceProfile(128, 15, 30),
  [LobbyOpaqueSection.ObservationFrame]: createSurfaceProfile(175, 32, 46),
  [LobbyOpaqueSection.Character]: createSurfaceProfile(190, 86, 78),
  [LobbyOpaqueSection.LampCable]: createSurfaceProfile(92, 35, 34),
  [LobbyOpaqueSection.LampHousing]: createSurfaceProfile(96, 14, 26),
  [LobbyOpaqueSection.RitualLampHousing]: createSurfaceProfile(78, 7, 17),
} satisfies Record<LobbyOpaqueSection, LobbySurfaceProfile>;

/** 把暗红分区色写入供内置 Standard 使用的大厅顶点流。 */
export class LobbyVertexShading {
  /** 按稳定区段刷新大厅全部不透明表面颜色。 */
  public update(
    geometry: SurfaceBufferGeometry,
    ranges: LobbyOpaqueSectionRanges,
  ): void {
    for (const section of LOBBY_OPAQUE_SECTION_ORDER) {
      shadeOpaqueSection(geometry, ranges[section], SECTION_PROFILES[section], section);
    }
  }
}

/** 根据表面法线和材质区段计算单个表面范围。 */
function shadeOpaqueSection(
  geometry: SurfaceBufferGeometry,
  range: LobbyOpaqueSectionRanges[LobbyOpaqueSection],
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
  if (section === LobbyOpaqueSection.FloorCracks) {
    return facet * 0.45;
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
