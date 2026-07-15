import { type EntityRange } from '../../../../../core/entities/entity-range';
import { type FixedTopologyGeometrySource } from '../../../../../core/geometry/fixed-topology';
import { SmoothCurveTessellator } from '../../../../../core/geometry/smooth-curve-tessellator';
import { type TriangleMeshWriter } from '../../../../../core/geometry/triangle-mesh-writer';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import {
  CURVE_CRAWLER_EYE_SEGMENTS,
  CURVE_CRAWLER_EYE_TOPOLOGY,
} from './curve-crawler-topology';

/** 写入 Curve Crawler 双眼的固定拓扑几何。 */
export class CurveCrawlerEyeGeometrySource
implements FixedTopologyGeometrySource<CurveCrawlerState> {
  public readonly metrics = CURVE_CRAWLER_EYE_TOPOLOGY;

  /** 将指定实体范围写入眼睛层。 */
  public write(writer: TriangleMeshWriter, state: CurveCrawlerState, range: EntityRange): void {
    const { transform, morphology, animation } = state.data;

    for (let index = range.start; index < range.end; index++) {
      const heading = transform.heading[index] ?? 0;
      const headingCosine = Math.cos(heading);
      const headingSine = Math.sin(heading);
      const bodyLength = morphology.bodyLength[index] ?? 0;
      const bodyWidth = morphology.bodyWidth[index] ?? 0;
      const forward = bodyLength * 0.48;
      const sideOffset = bodyWidth * 0.17;
      const radiusX = morphology.eyeRadius[index] ?? 0;
      const radiusY = radiusX * Math.max(animation.blinkScale[index] ?? 1, 0.08);
      const originX = transform.x[index] ?? 0;
      const originY = transform.y[index] ?? 0;

      for (let side = -1; side <= 1; side += 2) {
        const localY = side * sideOffset;
        const centerX = originX + forward * headingCosine - localY * headingSine;
        const centerY = originY + forward * headingSine + localY * headingCosine;
        SmoothCurveTessellator.appendEllipse(
          writer,
          centerX,
          centerY,
          radiusX,
          radiusY,
          heading,
          CURVE_CRAWLER_EYE_SEGMENTS,
          0.5,
        );
      }
    }
  }
}

/** Curve Crawler 眼睛层的无状态共享写入器。 */
export const curveCrawlerEyeGeometry = new CurveCrawlerEyeGeometrySource();
