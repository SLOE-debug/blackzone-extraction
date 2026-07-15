import { type EntityRange } from '../../../../../core/entities/entity-range';
import { type FixedTopologyGeometrySource } from '../../../../../core/geometry/fixed-topology';
import { type TriangleMeshWriter } from '../../../../../core/geometry/triangle-mesh-writer';
import { lerp, TAU } from '../../../../../core/math/scalar';
import { CURVE_CRAWLER_LIQUID_RAY_COUNT } from '../model/curve-crawler-schema';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { CURVE_CRAWLER_LIQUID_TOPOLOGY } from './curve-crawler-topology';

/** 将死亡实体写成不规则液体面，并沿世界负 Y 方向收拢消失。 */
export class CurveCrawlerLiquidGeometrySource
implements FixedTopologyGeometrySource<CurveCrawlerState> {
  public readonly metrics = CURVE_CRAWLER_LIQUID_TOPOLOGY;

  /** 写入指定实体范围内的固定射线液体扇面。 */
  public write(writer: TriangleMeshWriter, state: CurveCrawlerState, range: EntityRange): void {
    const { transform, morphology, animation } = state.data;

    for (let index = range.start; index < range.end; index++) {
      const originX = transform.x[index] ?? 0;
      const originY = transform.y[index] ?? 0;
      const heading = transform.heading[index] ?? 0;
      const headingCosine = Math.cos(heading);
      const headingSine = Math.sin(heading);
      const spread = animation.liquidSpread[index] ?? 0;
      const drain = animation.liquidDrain[index] ?? 0;
      const radiusX = ((morphology.bodyLength[index] ?? 0) * 0.8
        + (morphology.legLength[index] ?? 0) * 0.34) * spread;
      const radiusY = ((morphology.bodyWidth[index] ?? 0) * 0.75
        + (morphology.legLength[index] ?? 0) * 0.42) * spread;
      const sinkY = originY - radiusY * 1.35;
      const surfaceY = lerp(originY, sinkY, drain);
      const surfaceZ = 0.035 * (1 - drain);
      const firstVertex = writer.vertexCount;
      writer.vertex(originX, surfaceY, surfaceZ, 0, 0, 1);

      const radiusOffset = index * CURVE_CRAWLER_LIQUID_RAY_COUNT;
      for (let ray = 0; ray < CURVE_CRAWLER_LIQUID_RAY_COUNT; ray++) {
        const angle = ray / CURVE_CRAWLER_LIQUID_RAY_COUNT * TAU;
        const radiusScale = morphology.liquidRadiusScales[radiusOffset + ray] ?? 1;
        const localX = Math.cos(angle) * radiusX * radiusScale;
        const localY = Math.sin(angle) * radiusY * radiusScale;
        const expandedX = originX + localX * headingCosine - localY * headingSine;
        const expandedY = originY + localX * headingSine + localY * headingCosine;
        const drainedX = originX + (expandedX - originX) * 0.18;
        writer.vertex(
          lerp(expandedX, drainedX, drain),
          lerp(expandedY, sinkY, drain),
          surfaceZ,
          0,
          0,
          1,
        );
      }

      for (let ray = 0; ray < CURVE_CRAWLER_LIQUID_RAY_COUNT; ray++) {
        const current = firstVertex + 1 + ray;
        const next = firstVertex + 1 + (ray + 1) % CURVE_CRAWLER_LIQUID_RAY_COUNT;
        writer.triangle(firstVertex, current, next);
      }
    }
  }
}

/** Curve Crawler 液体层的无状态共享写入器。 */
export const curveCrawlerLiquidGeometry = new CurveCrawlerLiquidGeometrySource();
