import { type SurfaceBufferGeometry } from '../../core/geometry/buffer-geometry';
import { type SurfaceColorTint } from '../../core/rendering/directional-vertex-shading';
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

const SECTION_TINTS = {
  [LobbyOpaqueSection.Floor]: createTint(76, 8, 18),
  [LobbyOpaqueSection.Ceiling]: createTint(34, 3, 9),
  [LobbyOpaqueSection.BackWall]: createTint(58, 5, 14),
  [LobbyOpaqueSection.FrontWall]: createTint(49, 4, 12),
  [LobbyOpaqueSection.SideWalls]: createTint(66, 6, 16),
  [LobbyOpaqueSection.CircularPanel]: createTint(25, 2, 7),
  [LobbyOpaqueSection.CircularFrame]: createTint(132, 25, 39),
  [LobbyOpaqueSection.Character]: createTint(208, 113, 88),
  [LobbyOpaqueSection.LampCable]: createTint(24, 18, 19),
  [LobbyOpaqueSection.LampHousing]: createTint(57, 8, 14),
} satisfies Record<LobbyOpaqueSection, SurfaceColorTint>;

/** 把纯色分区和轻微分面差异写入大厅顶点色。 */
export class LobbyVertexShading {
  /** 按稳定区段刷新大厅全部不透明表面颜色。 */
  public update(
    geometry: SurfaceBufferGeometry,
    ranges: LobbyOpaqueSectionRanges,
  ): void {
    for (const section of OPAQUE_SECTION_ORDER) {
      shadeOpaqueSection(geometry, ranges[section], SECTION_TINTS[section], section);
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
      colors[colorOffset + 1] = 0.82;
      colors[colorOffset + 2] = 0.56;
      colors[colorOffset + 3] = 1;
    }
  }
}

/** 根据表面法线和材质区段计算单个表面范围。 */
function shadeOpaqueSection(
  geometry: SurfaceBufferGeometry,
  range: Readonly<LobbyVertexRange>,
  tint: Readonly<SurfaceColorTint>,
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
    colors[colorOffset] = Math.min(1, tint.red * shade);
    colors[colorOffset + 1] = Math.min(1, tint.green * shade);
    colors[colorOffset + 2] = Math.min(1, tint.blue * shade);
    colors[colorOffset + 3] = tint.alpha;
  }
}

/** 计算不会替代实时 SpotLight 的轻微分面色差。 */
function getSectionShade(
  section: LobbyOpaqueSection,
  normalX: number,
  normalY: number,
  normalZ: number,
): number {
  const facet = 0.82
    + Math.max(0, normalY) * 0.1
    + Math.max(0, normalZ) * 0.045
    + Math.max(0, -normalX) * 0.025;
  if (section === LobbyOpaqueSection.CircularPanel) {
    return facet * 0.72;
  }
  if (section === LobbyOpaqueSection.Character) {
    return Math.min(1, facet * 1.06);
  }
  return Math.min(1, facet);
}

/** 从字节色创建归一化表面色。 */
function createTint(red: number, green: number, blue: number): SurfaceColorTint {
  return Object.freeze({
    red: red * BYTE_COLOR_SCALE,
    green: green * BYTE_COLOR_SCALE,
    blue: blue * BYTE_COLOR_SCALE,
    alpha: 1,
  });
}

export const lobbyVertexShading = new LobbyVertexShading();
export const lobbyGlowVertexShading = new LobbyGlowVertexShading();
