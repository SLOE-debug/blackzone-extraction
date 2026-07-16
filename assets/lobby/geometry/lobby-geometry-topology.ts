import { type FixedTopologyMetrics } from '../../core/geometry/fixed-topology';
import { type GeometrySectionMap } from './infrastructure/geometry-section-composer';
import { LOBBY_ALTAR_TRIANGLE_COUNT } from './lobby-altar-layout';
import { LOBBY_FLOOR_CRACK_SEGMENT_COUNT } from './lobby-floor-crack-layout';
import {
  LOBBY_RITUAL_LAMP_GLOW_TRIANGLES_PER_LIGHT,
  LOBBY_RITUAL_LAMP_HOUSING_TRIANGLES_PER_LIGHT,
  LOBBY_RITUAL_LAMP_POSITIONS,
} from './lobby-ritual-lamp-layout';
import {
  LOBBY_OBSERVATION_FRAME_TRIANGLES,
  LOBBY_OBSERVATION_WALL_TRIANGLES,
} from './lobby-observation-window-geometry';
import {
  getLobbyHallSurfaceMetrics,
  LobbyHallSurfaceId,
} from './recipes/lobby-shell-recipe';

export const LOBBY_FLOOR_TRIANGLES = getTriangleCount(LobbyHallSurfaceId.Floor);
export const LOBBY_CEILING_TRIANGLES = getTriangleCount(LobbyHallSurfaceId.Ceiling);
export const LOBBY_FLOOR_CRACK_TRIANGLES = LOBBY_FLOOR_CRACK_SEGMENT_COUNT * 2;
export const LOBBY_BACK_WALL_TRIANGLES = LOBBY_OBSERVATION_WALL_TRIANGLES;
export const LOBBY_FRONT_WALL_TRIANGLES = getTriangleCount(LobbyHallSurfaceId.FrontWall);
export const LOBBY_SIDE_WALL_TRIANGLES = getTriangleCount(LobbyHallSurfaceId.LeftWall)
  + getTriangleCount(LobbyHallSurfaceId.RightWall);
export const LOBBY_ALTAR_TRIANGLES = LOBBY_ALTAR_TRIANGLE_COUNT;
export const LOBBY_OBSERVATION_FRAME_TRIANGLE_COUNT = LOBBY_OBSERVATION_FRAME_TRIANGLES;
export const LOBBY_CHARACTER_TRIANGLES = 8 * 2 * 2 + 8 * 2;
export const LOBBY_LAMP_CABLE_TRIANGLES = 6 * 2 * 2;
export const LOBBY_LAMP_HOUSING_TRIANGLES = 16 * 4;
export const LOBBY_LAMP_GLOW_TRIANGLES = 16;
export const LOBBY_RITUAL_LAMP_HOUSING_TRIANGLES = LOBBY_RITUAL_LAMP_POSITIONS.length
  * LOBBY_RITUAL_LAMP_HOUSING_TRIANGLES_PER_LIGHT;
export const LOBBY_RITUAL_LAMP_GLOW_TRIANGLES = LOBBY_RITUAL_LAMP_POSITIONS.length
  * LOBBY_RITUAL_LAMP_GLOW_TRIANGLES_PER_LIGHT;

const LOBBY_OPAQUE_TRIANGLES = LOBBY_FLOOR_TRIANGLES
  + LOBBY_FLOOR_CRACK_TRIANGLES
  + LOBBY_CEILING_TRIANGLES
  + LOBBY_BACK_WALL_TRIANGLES
  + LOBBY_FRONT_WALL_TRIANGLES
  + LOBBY_SIDE_WALL_TRIANGLES
  + LOBBY_ALTAR_TRIANGLES
  + LOBBY_OBSERVATION_FRAME_TRIANGLE_COUNT
  + LOBBY_CHARACTER_TRIANGLES
  + LOBBY_LAMP_CABLE_TRIANGLES
  + LOBBY_LAMP_HOUSING_TRIANGLES
  + LOBBY_RITUAL_LAMP_HOUSING_TRIANGLES;

/** 大厅不透明表面的稳定顶点区段。 */
export enum LobbyOpaqueSection {
  Floor = 'floor',
  FloorCracks = 'floor-cracks',
  Ceiling = 'ceiling',
  BackWall = 'back-wall',
  FrontWall = 'front-wall',
  SideWalls = 'side-walls',
  Altar = 'altar',
  ObservationFrame = 'observation-frame',
  Character = 'character',
  LampCable = 'lamp-cable',
  LampHousing = 'lamp-housing',
  RitualLampHousing = 'ritual-lamp-housing',
}

/** 大厅不透明区段的唯一稳定写入顺序。 */
export const LOBBY_OPAQUE_SECTION_ORDER: readonly LobbyOpaqueSection[] = Object.freeze([
  LobbyOpaqueSection.Floor,
  LobbyOpaqueSection.FloorCracks,
  LobbyOpaqueSection.Ceiling,
  LobbyOpaqueSection.BackWall,
  LobbyOpaqueSection.FrontWall,
  LobbyOpaqueSection.SideWalls,
  LobbyOpaqueSection.Altar,
  LobbyOpaqueSection.ObservationFrame,
  LobbyOpaqueSection.Character,
  LobbyOpaqueSection.LampCable,
  LobbyOpaqueSection.LampHousing,
  LobbyOpaqueSection.RitualLampHousing,
]);

/** 大厅不透明几何的完整区段映射。 */
export type LobbyOpaqueSectionRanges = GeometrySectionMap<LobbyOpaqueSection>;

/** 每个三角形独占三个顶点，以保留明确的 Low Poly 分面法线。 */
export const LOBBY_OPAQUE_TOPOLOGY: FixedTopologyMetrics = Object.freeze({
  verticesPerEntity: LOBBY_OPAQUE_TRIANGLES * 3,
  indicesPerEntity: LOBBY_OPAQUE_TRIANGLES * 3,
});

/** 灯具暖白发光面的固定拓扑。 */
export const LOBBY_GLOW_TOPOLOGY: FixedTopologyMetrics = Object.freeze({
  verticesPerEntity: LOBBY_LAMP_GLOW_TRIANGLES * 3,
  indicesPerEntity: LOBBY_LAMP_GLOW_TRIANGLES * 3,
});

/** 围绕祭台的暗红晶体发光面固定拓扑。 */
export const LOBBY_RITUAL_GLOW_TOPOLOGY: FixedTopologyMetrics = Object.freeze({
  verticesPerEntity: LOBBY_RITUAL_LAMP_GLOW_TRIANGLES * 3,
  indicesPerEntity: LOBBY_RITUAL_LAMP_GLOW_TRIANGLES * 3,
});

/** 从 Flat Grid Recipe 的固定索引数推导三角形数量。 */
function getTriangleCount(surface: LobbyHallSurfaceId): number {
  return getLobbyHallSurfaceMetrics(surface).indicesPerEntity / 3;
}
