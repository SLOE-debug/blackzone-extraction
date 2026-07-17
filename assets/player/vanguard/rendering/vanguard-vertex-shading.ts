import { type EntityRange } from '../../../core/entities/entity-range';
import { type SurfaceBufferGeometry } from '../../../core/geometry/buffer-geometry';
import {
  type SurfaceColorTint,
  type SurfaceVertexShading,
} from '../../../core/rendering/directional-vertex-shading';
import {
  getVanguardMatteSurfaceRange,
  getVanguardMetalSurfaceRange,
  VANGUARD_MATTE_TOPOLOGY,
  VANGUARD_METAL_TOPOLOGY,
} from '../geometry/vanguard-topology';
import { VanguardMatteSurface, VanguardMetalSurface } from '../geometry/vanguard-surface';
import { type VanguardState } from '../model/vanguard-state';

const BYTE_COLOR_SCALE = 1 / 255;
const MATTE_TINTS = Object.freeze([
  tint(205, 145, 102),
  tint(205, 145, 102),
  tint(43, 35, 34),
  tint(73, 45, 28),
  tint(38, 101, 142),
  tint(180, 58, 51),
  tint(31, 49, 61),
  tint(98, 61, 36),
] satisfies readonly SurfaceColorTint[]);
const METAL_TINTS = Object.freeze([
  tint(177, 190, 198),
  tint(188, 137, 57),
] satisfies readonly SurfaceColorTint[]);

/** 为皮肤、面部、衣物、头发和皮具写入清晰的英雄配色。 */
class VanguardMatteVertexShading implements SurfaceVertexShading<VanguardState> {
  public update(
    geometry: SurfaceBufferGeometry,
    _state: VanguardState,
    range: EntityRange,
  ): void {
    const verticesPerEntity = VANGUARD_MATTE_TOPOLOGY.verticesPerEntity;
    if (geometry.vertexCount !== range.count * verticesPerEntity) {
      throw new Error('主角哑光层顶点数量不符合固定拓扑。');
    }
    for (let localIndex = 0; localIndex < range.count; localIndex++) {
      const entityStart = localIndex * verticesPerEntity;
      for (let surface = VanguardMatteSurface.Skin;
        surface < VanguardMatteSurface.Count;
        surface++) {
        const semanticSurface = surface as VanguardMatteSurface;
        const surfaceRange = getVanguardMatteSurfaceRange(semanticSurface);
        const color = MATTE_TINTS[semanticSurface];
        if (color === undefined) {
          throw new Error(`主角哑光表面颜色不存在：${semanticSurface}`);
        }
        const variation = semanticSurface === VanguardMatteSurface.NeckSkin
          ? 0
          : semanticSurface === VanguardMatteSurface.Skin
            ? 0.065
            : 0.1;
        fillFacetedColorRange(
          geometry,
          entityStart + surfaceRange.startVertex,
          surfaceRange.vertexCount,
          color,
          variation,
        );
      }
    }
  }
}

/** 为钢制长剑与黄铜扣件写入中性金属色。 */
class VanguardMetalVertexShading implements SurfaceVertexShading<VanguardState> {
  public update(
    geometry: SurfaceBufferGeometry,
    _state: VanguardState,
    range: EntityRange,
  ): void {
    const verticesPerEntity = VANGUARD_METAL_TOPOLOGY.verticesPerEntity;
    if (geometry.vertexCount !== range.count * verticesPerEntity) {
      throw new Error('主角金属层顶点数量不符合固定拓扑。');
    }
    for (let localIndex = 0; localIndex < range.count; localIndex++) {
      const entityStart = localIndex * verticesPerEntity;
      for (let surface = VanguardMetalSurface.Steel;
        surface < VanguardMetalSurface.Count;
        surface++) {
        const semanticSurface = surface as VanguardMetalSurface;
        const surfaceRange = getVanguardMetalSurfaceRange(semanticSurface);
        const color = METAL_TINTS[semanticSurface];
        if (color === undefined) {
          throw new Error(`主角金属表面颜色不存在：${semanticSurface}`);
        }
        fillFacetedColorRange(
          geometry,
          entityStart + surfaceRange.startVertex,
          surfaceRange.vertexCount,
          color,
          0.12,
        );
      }
    }
  }
}

/** 为连续三角面写入克制且确定的面间色差。 */
function fillFacetedColorRange(
  geometry: SurfaceBufferGeometry,
  startVertex: number,
  vertexCount: number,
  color: Readonly<SurfaceColorTint>,
  variation: number,
): void {
  const endVertex = startVertex + vertexCount;
  for (let vertex = startVertex; vertex < endVertex; vertex++) {
    const triangle = Math.floor((vertex - startVertex) / 3);
    const sequence = (triangle * 5 + Math.floor(startVertex / 3)) % 7;
    const shade = 1 - variation * 0.55 + sequence / 6 * variation;
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

export const vanguardMatteVertexShading: SurfaceVertexShading<VanguardState>
  = new VanguardMatteVertexShading();
export const vanguardMetalVertexShading: SurfaceVertexShading<VanguardState>
  = new VanguardMetalVertexShading();
