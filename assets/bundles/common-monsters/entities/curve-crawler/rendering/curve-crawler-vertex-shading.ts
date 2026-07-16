import { type SurfaceBufferGeometry } from '../../../../../core/geometry/buffer-geometry';
import { type EntityRange } from '../../../../../core/entities/entity-range';
import { lerp } from '../../../../../core/math/scalar';
import {
  type SurfaceColorTint,
  type SurfaceVertexShading,
} from '../../../../../core/rendering/directional-vertex-shading';
import {
  CURVE_CRAWLER_BODY_TOPOLOGY,
  CURVE_CRAWLER_EYE_TOPOLOGY,
  CURVE_CRAWLER_LIQUID_TOPOLOGY,
  CURVE_CRAWLER_SURFACE_TOPOLOGY,
} from '../geometry/curve-crawler-topology';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

const BYTE_COLOR_SCALE = 1 / 255;
const BODY_TINT: SurfaceColorTint = Object.freeze({
  red: 92 * BYTE_COLOR_SCALE,
  green: 84 * BYTE_COLOR_SCALE,
  blue: 102 * BYTE_COLOR_SCALE,
  alpha: 1,
});
const EYE_TINT: SurfaceColorTint = Object.freeze({
  red: 1,
  green: 168 * BYTE_COLOR_SCALE,
  blue: 188 * BYTE_COLOR_SCALE,
  alpha: 1,
});
const HIT_TINT: SurfaceColorTint = Object.freeze({
  red: 1,
  green: 12 * BYTE_COLOR_SCALE,
  blue: 7 * BYTE_COLOR_SCALE,
  alpha: 1,
});
const LIQUID_TINT: SurfaceColorTint = Object.freeze({
  red: 27 * BYTE_COLOR_SCALE,
  green: 82 * BYTE_COLOR_SCALE,
  blue: 45 * BYTE_COLOR_SCALE,
  alpha: 1,
});
const DRAINED_LIQUID_TINT: SurfaceColorTint = Object.freeze({
  red: 8 * BYTE_COLOR_SCALE,
  green: 30 * BYTE_COLOR_SCALE,
  blue: 17 * BYTE_COLOR_SCALE,
  alpha: 1,
});

/** 为身体、双眼和液体写入交由 Standard 实时光照解释的表面色。 */
class CurveCrawlerVertexShading implements SurfaceVertexShading<CurveCrawlerState> {
  private readonly mixedTint = { red: 0, green: 0, blue: 0, alpha: 1 };

  /** 按合并几何的稳定顶点布局原地刷新颜色流。 */
  public update(
    geometry: SurfaceBufferGeometry,
    state: CurveCrawlerState,
    range: EntityRange,
  ): void {
    const expectedVertexCount = range.count * CURVE_CRAWLER_SURFACE_TOPOLOGY.verticesPerEntity;
    if (geometry.vertexCount !== expectedVertexCount) {
      throw new Error('Curve Crawler 合并表面的顶点数量不符合固定拓扑。');
    }

    const bodyVertexCount = range.count * CURVE_CRAWLER_BODY_TOPOLOGY.verticesPerEntity;
    const eyeVertexCount = range.count * CURVE_CRAWLER_EYE_TOPOLOGY.verticesPerEntity;
    const liquidStartVertex = bodyVertexCount + eyeVertexCount;

    for (let localIndex = 0; localIndex < range.count; localIndex++) {
      const entityIndex = range.start + localIndex;
      const hitFlash = state.data.animation.hitFlash[entityIndex] ?? 0;
      const liquidDrain = state.data.animation.liquidDrain[entityIndex] ?? 0;

      mixTint(this.mixedTint, BODY_TINT, HIT_TINT, hitFlash);
      fillVertexColorRange(
        geometry,
        localIndex * CURVE_CRAWLER_BODY_TOPOLOGY.verticesPerEntity,
        CURVE_CRAWLER_BODY_TOPOLOGY.verticesPerEntity,
        this.mixedTint,
      );

      mixTint(this.mixedTint, EYE_TINT, HIT_TINT, hitFlash);
      fillVertexColorRange(
        geometry,
        bodyVertexCount + localIndex * CURVE_CRAWLER_EYE_TOPOLOGY.verticesPerEntity,
        CURVE_CRAWLER_EYE_TOPOLOGY.verticesPerEntity,
        this.mixedTint,
      );

      mixTint(this.mixedTint, LIQUID_TINT, DRAINED_LIQUID_TINT, liquidDrain);
      fillVertexColorRange(
        geometry,
        liquidStartVertex + localIndex * CURVE_CRAWLER_LIQUID_TOPOLOGY.verticesPerEntity,
        CURVE_CRAWLER_LIQUID_TOPOLOGY.verticesPerEntity,
        this.mixedTint,
      );
    }
  }
}

/** 把不含预烘焙明暗的颜色写入连续顶点范围。 */
function fillVertexColorRange(
  geometry: SurfaceBufferGeometry,
  startVertex: number,
  vertexCount: number,
  tint: Readonly<SurfaceColorTint>,
): void {
  const endVertex = startVertex + vertexCount;
  for (let vertex = startVertex; vertex < endVertex; vertex++) {
    const offset = vertex * 4;
    geometry.colors[offset] = tint.red;
    geometry.colors[offset + 1] = tint.green;
    geometry.colors[offset + 2] = tint.blue;
    geometry.colors[offset + 3] = tint.alpha;
  }
}

/** 将两种表面颜色按强度混合到可复用目标对象。 */
function mixTint(
  target: { red: number; green: number; blue: number; alpha: number },
  from: Readonly<SurfaceColorTint>,
  to: Readonly<SurfaceColorTint>,
  amount: number,
): void {
  target.red = lerp(from.red, to.red, amount);
  target.green = lerp(from.green, to.green, amount);
  target.blue = lerp(from.blue, to.blue, amount);
  target.alpha = lerp(from.alpha, to.alpha, amount);
}

/** Curve Crawler 合并表面共享的顶点着色策略。 */
export const curveCrawlerVertexShading: SurfaceVertexShading<CurveCrawlerState>
  = new CurveCrawlerVertexShading();
