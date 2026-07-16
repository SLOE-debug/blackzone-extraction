import { type EntityRange } from '../../../core/entities/entity-range';
import { type SurfaceBufferGeometry } from '../../../core/geometry/buffer-geometry';
import {
  type SurfaceColorTint,
  type SurfaceVertexShading,
} from '../../../core/rendering/directional-vertex-shading';
import { type VanguardState } from '../model/vanguard-state';
import {
  VANGUARD_ARMOR_VERTEX_COUNT,
  VANGUARD_OPAQUE_TOPOLOGY,
  VANGUARD_PANEL_VERTEX_COUNT,
  VANGUARD_SENSOR_TOPOLOGY,
  VANGUARD_WEAPON_VERTEX_COUNT,
} from '../geometry/vanguard-topology';

const BYTE_COLOR_SCALE = 1 / 255;
const ARMOR_TINT = tint(43, 45, 49);
const PANEL_TINT = tint(19, 20, 23);
const WEAPON_TINT = tint(13, 14, 16);
const SENSOR_TINT = tint(246, 248, 250);

/** 按固定部件区段写入不替代真实灯光的金属表面色。 */
class VanguardOpaqueVertexShading implements SurfaceVertexShading<VanguardState> {
  /** 刷新黑色主体装甲、深黑战术面板和手枪颜色。 */
  public update(
    geometry: SurfaceBufferGeometry,
    _state: VanguardState,
    range: EntityRange,
  ): void {
    const expectedVertexCount = range.count * VANGUARD_OPAQUE_TOPOLOGY.verticesPerEntity;
    if (geometry.vertexCount !== expectedVertexCount) {
      throw new Error('主角受光层顶点数量不符合固定拓扑。');
    }

    for (let localIndex = 0; localIndex < range.count; localIndex++) {
      const entityStart = localIndex * VANGUARD_OPAQUE_TOPOLOGY.verticesPerEntity;
      fillFacetedColorRange(geometry, entityStart, VANGUARD_ARMOR_VERTEX_COUNT, ARMOR_TINT);
      const panelStart = entityStart + VANGUARD_ARMOR_VERTEX_COUNT;
      fillFacetedColorRange(geometry, panelStart, VANGUARD_PANEL_VERTEX_COUNT, PANEL_TINT);
      const weaponStart = panelStart + VANGUARD_PANEL_VERTEX_COUNT;
      fillFacetedColorRange(geometry, weaponStart, VANGUARD_WEAPON_VERTEX_COUNT, WEAPON_TINT);
    }
  }
}

/** 为独眼、头侧灯和前臂识别灯写入纯白发光色。 */
class VanguardSensorVertexShading implements SurfaceVertexShading<VanguardState> {
  /** 刷新不受实时灯光衰减影响的传感器颜色。 */
  public update(
    geometry: SurfaceBufferGeometry,
    _state: VanguardState,
    range: EntityRange,
  ): void {
    const expectedVertexCount = range.count * VANGUARD_SENSOR_TOPOLOGY.verticesPerEntity;
    if (geometry.vertexCount !== expectedVertexCount) {
      throw new Error('主角传感器层顶点数量不符合固定拓扑。');
    }
    fillFacetedColorRange(geometry, 0, geometry.vertexCount, SENSOR_TINT);
  }
}

/** 为相邻三角面写入轻微确定性色差，强化装甲切面节奏。 */
function fillFacetedColorRange(
  geometry: SurfaceBufferGeometry,
  startVertex: number,
  vertexCount: number,
  color: Readonly<SurfaceColorTint>,
): void {
  const endVertex = startVertex + vertexCount;
  for (let vertex = startVertex; vertex < endVertex; vertex++) {
    const triangle = Math.floor((vertex - startVertex) / 3);
    const shade = 0.88 + (triangle % 5) * 0.027;
    const colorOffset = vertex * 4;
    geometry.colors[colorOffset] = Math.min(1, color.red * shade);
    geometry.colors[colorOffset + 1] = Math.min(1, color.green * shade);
    geometry.colors[colorOffset + 2] = Math.min(1, color.blue * shade);
    geometry.colors[colorOffset + 3] = color.alpha;
  }
}

/** 创建归一化不透明颜色。 */
function tint(red: number, green: number, blue: number): SurfaceColorTint {
  return Object.freeze({
    red: red * BYTE_COLOR_SCALE,
    green: green * BYTE_COLOR_SCALE,
    blue: blue * BYTE_COLOR_SCALE,
    alpha: 1,
  });
}

export const vanguardOpaqueVertexShading: SurfaceVertexShading<VanguardState>
  = new VanguardOpaqueVertexShading();
export const vanguardSensorVertexShading: SurfaceVertexShading<VanguardState>
  = new VanguardSensorVertexShading();
