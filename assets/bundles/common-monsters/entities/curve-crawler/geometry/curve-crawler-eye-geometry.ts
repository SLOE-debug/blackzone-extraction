import { type EntityRange } from '../../../../../core/entities/entity-range';
import { type FixedTopologyGeometrySource } from '../../../../../core/geometry/fixed-topology';
import { type TriangleMeshWriter } from '../../../../../core/geometry/triangle-mesh-writer';
import { VolumetricTessellator } from '../../../../../core/geometry/volumetric-tessellator';
import {
  CURVE_CRAWLER_FRAGMENT_COUNT,
  CurveCrawlerFragmentIndex,
} from '../model/curve-crawler-schema';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { writeCurveCrawlerDegenerateGeometry } from './curve-crawler-degenerate-geometry';
import {
  CURVE_CRAWLER_EYE_LATITUDE_SEGMENTS,
  CURVE_CRAWLER_EYE_LONGITUDE_SEGMENTS,
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
      const originX = transform.x[index] ?? 0;
      const originY = transform.y[index] ?? 0;
      const surfaceCollapse = animation.surfaceCollapse[index] ?? 0;
      if (surfaceCollapse >= 0.999) {
        writeCurveCrawlerDegenerateGeometry(
          writer,
          CURVE_CRAWLER_EYE_TOPOLOGY.verticesPerEntity,
          CURVE_CRAWLER_EYE_TOPOLOGY.indicesPerEntity,
          originX,
          originY,
          0,
        );
        continue;
      }

      const heading = transform.heading[index] ?? 0;
      const headingCosine = Math.cos(heading);
      const headingSine = Math.sin(heading);
      const originalBodyLength = morphology.bodyLength[index] ?? 0;
      const originalBodyWidth = morphology.bodyWidth[index] ?? 0;
      const fragmentScale = Math.max(0.0001, 1 - surfaceCollapse);
      const bodyLength = originalBodyLength;
      const bodyWidth = originalBodyWidth;
      const forward = bodyLength * 0.48;
      const sideOffset = bodyWidth * 0.17;
      const radiusX = Math.max((morphology.eyeRadius[index] ?? 0) * fragmentScale, 0.0001);
      const radiusY = radiusX * 0.92;
      const radiusZ = radiusX * Math.max(animation.blinkScale[index] ?? 1, 0.08);
      const thoraxRadiusZ = bodyWidth * 0.36;
      const crouchAmount = animation.crouchAmount[index] ?? 0;
      const eyeCenterZ = thoraxRadiusZ * (1.8 - crouchAmount * 0.2);
      const fragmentOffset = index * CURVE_CRAWLER_FRAGMENT_COUNT;

      for (let side = -1; side <= 1; side += 2) {
        const fragmentIndex = fragmentOffset + (side < 0
          ? CurveCrawlerFragmentIndex.LeftEye
          : CurveCrawlerFragmentIndex.RightEye);
        const localY = side * sideOffset;
        const centerX = originX + forward * headingCosine - localY * headingSine
          + (animation.fragmentOffsetX[fragmentIndex] ?? 0);
        const centerY = originY + forward * headingSine + localY * headingCosine
          + (animation.fragmentOffsetY[fragmentIndex] ?? 0);
        VolumetricTessellator.appendEllipsoid(
          writer,
          centerX,
          centerY,
          eyeCenterZ + (animation.fragmentOffsetZ[fragmentIndex] ?? 0),
          radiusX,
          radiusY,
          radiusZ,
          heading + (animation.fragmentRotation[fragmentIndex] ?? 0),
          CURVE_CRAWLER_EYE_LONGITUDE_SEGMENTS,
          CURVE_CRAWLER_EYE_LATITUDE_SEGMENTS,
        );
      }
    }
  }
}

/** Curve Crawler 眼睛层的无状态共享写入器。 */
export const curveCrawlerEyeGeometry = new CurveCrawlerEyeGeometrySource();
