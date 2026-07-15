import { type SurfaceBufferGeometry } from '../geometry/buffer-geometry';
import { type EntityRange } from '../entities/entity-range';

const LIGHT_DIRECTION_X = -0.36;
const LIGHT_DIRECTION_Y = -0.48;
const LIGHT_DIRECTION_Z = 0.8;

/** 方向光顶点着色使用的线性表面色。 */
export interface SurfaceColorTint {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

const WHITE_SURFACE_TINT: SurfaceColorTint = Object.freeze({
  red: 1,
  green: 1,
  blue: 1,
  alpha: 1,
});

/** 根据表面法线刷新动态顶点颜色的策略。 */
export interface SurfaceVertexShading<TSource = unknown> {
  update(geometry: SurfaceBufferGeometry, source: TSource, range: EntityRange): void;
}

/**
 * 将固定世界方向的漫反射明暗烘入动态顶点色。
 *
 * 该策略不依赖场景 Effect 或实时灯光，适合大量程序化动态网格。
 */
class DirectionalVertexShading implements SurfaceVertexShading<unknown> {
  /** 根据当前法线原地更新 RGBA 颜色流。 */
  public update(geometry: SurfaceBufferGeometry): void {
    shadeDirectionalVertexRange(geometry, 0, geometry.vertexCount, WHITE_SURFACE_TINT);
  }
}

/**
 * 将固定方向漫反射和指定表面色写入连续顶点范围。
 *
 * @param geometry 待更新的表面几何。
 * @param startVertex 起始顶点索引。
 * @param vertexCount 连续顶点数量。
 * @param tint 归一化 RGBA 表面色。
 */
export function shadeDirectionalVertexRange(
  geometry: SurfaceBufferGeometry,
  startVertex: number,
  vertexCount: number,
  tint: Readonly<SurfaceColorTint>,
): void {
  const endVertex = startVertex + vertexCount;
  if (!Number.isInteger(startVertex) || !Number.isInteger(vertexCount)
    || startVertex < 0 || vertexCount < 0 || endVertex > geometry.vertexCount) {
    throw new Error('方向光顶点着色范围无效。');
  }

  const { normals, colors } = geometry;
  for (let vertex = startVertex; vertex < endVertex; vertex++) {
    const normalOffset = vertex * 3;
    const normalX = normals[normalOffset] ?? 0;
    const normalY = normals[normalOffset + 1] ?? 0;
    const normalZ = normals[normalOffset + 2] ?? 0;
    const diffuse = Math.max(
      0,
      normalX * LIGHT_DIRECTION_X
        + normalY * LIGHT_DIRECTION_Y
        + normalZ * LIGHT_DIRECTION_Z,
    );
    const topFill = Math.max(0, normalZ) * 0.1;
    const shade = Math.min(1, 0.32 + diffuse * 0.58 + topFill);
    const colorOffset = vertex * 4;
    colors[colorOffset] = tint.red * shade;
    colors[colorOffset + 1] = tint.green * shade;
    colors[colorOffset + 2] = tint.blue * shade;
    colors[colorOffset + 3] = tint.alpha;
  }
}

/** 大量动态表面共享的无状态方向光顶点着色器。 */
export const directionalVertexShading: SurfaceVertexShading<unknown> = new DirectionalVertexShading();
