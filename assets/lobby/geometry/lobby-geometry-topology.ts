import { type FixedTopologyMetrics } from '../../core/geometry/fixed-topology';

export const LOBBY_FLOOR_TRIANGLES = 6 * 7 * 2;
export const LOBBY_CEILING_TRIANGLES = 6 * 5 * 2;
export const LOBBY_BACK_WALL_TRIANGLES = 6 * 4 * 2;
export const LOBBY_FRONT_WALL_TRIANGLES = 6 * 4 * 2;
export const LOBBY_SIDE_WALL_TRIANGLES = 7 * 4 * 2 * 2;
export const LOBBY_CIRCULAR_PANEL_TRIANGLES = 20;
export const LOBBY_CIRCULAR_FRAME_TRIANGLES = 20 * 6;
export const LOBBY_CHARACTER_TRIANGLES = 8 * 2 * 2 + 8 * 2;
export const LOBBY_LAMP_CABLE_TRIANGLES = 6 * 2 * 2;
export const LOBBY_LAMP_HOUSING_TRIANGLES = 16 * 4;
export const LOBBY_LAMP_GLOW_TRIANGLES = 16;

const LOBBY_OPAQUE_TRIANGLES = LOBBY_FLOOR_TRIANGLES
  + LOBBY_CEILING_TRIANGLES
  + LOBBY_BACK_WALL_TRIANGLES
  + LOBBY_FRONT_WALL_TRIANGLES
  + LOBBY_SIDE_WALL_TRIANGLES
  + LOBBY_CIRCULAR_PANEL_TRIANGLES
  + LOBBY_CIRCULAR_FRAME_TRIANGLES
  + LOBBY_CHARACTER_TRIANGLES
  + LOBBY_LAMP_CABLE_TRIANGLES
  + LOBBY_LAMP_HOUSING_TRIANGLES;

/** 大厅不透明表面的稳定顶点区段。 */
export enum LobbyOpaqueSection {
  Floor = 'floor',
  Ceiling = 'ceiling',
  BackWall = 'back-wall',
  FrontWall = 'front-wall',
  SideWalls = 'side-walls',
  CircularPanel = 'circular-panel',
  CircularFrame = 'circular-frame',
  Character = 'character',
  LampCable = 'lamp-cable',
  LampHousing = 'lamp-housing',
}

/** 单个顶点色区段在合并几何中的连续范围。 */
export interface LobbyVertexRange {
  readonly startVertex: number;
  readonly vertexCount: number;
}

/** 大厅不透明几何的完整区段映射。 */
export type LobbyOpaqueSectionRanges = Readonly<Record<LobbyOpaqueSection, LobbyVertexRange>>;

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
