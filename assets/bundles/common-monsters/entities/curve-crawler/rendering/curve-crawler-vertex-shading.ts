import { type SurfaceBufferGeometry } from '../../../../../core/geometry/buffer-geometry';
import {
  shadeDirectionalVertexRange,
  type SurfaceColorTint,
  type SurfaceVertexShading,
} from '../../../../../core/rendering/directional-vertex-shading';
import {
  CURVE_CRAWLER_BODY_TOPOLOGY,
  CURVE_CRAWLER_SURFACE_TOPOLOGY,
} from '../geometry/curve-crawler-topology';

const BYTE_COLOR_SCALE = 1 / 255;
const BODY_TINT: SurfaceColorTint = Object.freeze({
  red: 24 * BYTE_COLOR_SCALE,
  green: 23 * BYTE_COLOR_SCALE,
  blue: 29 * BYTE_COLOR_SCALE,
  alpha: 1,
});
const EYE_TINT: SurfaceColorTint = Object.freeze({
  red: 1,
  green: 24 * BYTE_COLOR_SCALE,
  blue: 34 * BYTE_COLOR_SCALE,
  alpha: 1,
});

/** 为合并表面的身体和双眼写入各自的方向光顶点色。 */
class CurveCrawlerVertexShading implements SurfaceVertexShading {
  /** 按合并几何的稳定顶点布局原地刷新颜色流。 */
  public update(geometry: SurfaceBufferGeometry): void {
    const entityCount = geometry.vertexCount / CURVE_CRAWLER_SURFACE_TOPOLOGY.verticesPerEntity;
    if (!Number.isInteger(entityCount)) {
      throw new Error('Curve Crawler 合并表面的顶点数量不符合固定拓扑。');
    }

    const bodyVertexCount = entityCount * CURVE_CRAWLER_BODY_TOPOLOGY.verticesPerEntity;
    shadeDirectionalVertexRange(geometry, 0, bodyVertexCount, BODY_TINT);
    shadeDirectionalVertexRange(
      geometry,
      bodyVertexCount,
      geometry.vertexCount - bodyVertexCount,
      EYE_TINT,
    );
  }
}

/** Curve Crawler 合并表面共享的无状态顶点着色策略。 */
export const curveCrawlerVertexShading: SurfaceVertexShading = new CurveCrawlerVertexShading();
