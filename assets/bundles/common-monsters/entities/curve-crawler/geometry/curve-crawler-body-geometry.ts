import { type EntityRange } from '../../../../../core/entities/entity-range';
import { type FixedTopologyGeometrySource } from '../../../../../core/geometry/fixed-topology';
import { type TriangleMeshWriter } from '../../../../../core/geometry/triangle-mesh-writer';
import { VolumetricTessellator } from '../../../../../core/geometry/volumetric-tessellator';
import {
  CURVE_CRAWLER_FRAGMENT_COUNT,
  CURVE_CRAWLER_LEG_COUNT,
  CurveCrawlerFragmentIndex,
} from '../model/curve-crawler-schema';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { writeCurveCrawlerDegenerateGeometry } from './curve-crawler-degenerate-geometry';
import { writeCurveCrawlerLeg } from './curve-crawler-leg-geometry';
import {
  CURVE_CRAWLER_BODY_LATITUDE_SEGMENTS,
  CURVE_CRAWLER_BODY_LONGITUDE_SEGMENTS,
  CURVE_CRAWLER_BODY_TOPOLOGY,
} from './curve-crawler-topology';

/** 写入 Curve Crawler 腿部、腹部和胸部的固定拓扑几何。 */
export class CurveCrawlerBodyGeometrySource
implements FixedTopologyGeometrySource<CurveCrawlerState> {
  public readonly metrics = CURVE_CRAWLER_BODY_TOPOLOGY;

  /** 将指定实体范围写入黑色身体层。 */
  public write(writer: TriangleMeshWriter, state: CurveCrawlerState, range: EntityRange): void {
    const { transform, morphology, animation } = state.data;

    for (let index = range.start; index < range.end; index++) {
      const originX = transform.x[index] ?? 0;
      const originY = transform.y[index] ?? 0;
      const surfaceCollapse = animation.surfaceCollapse[index] ?? 0;
      if (surfaceCollapse >= 0.999) {
        writeCurveCrawlerDegenerateGeometry(
          writer,
          CURVE_CRAWLER_BODY_TOPOLOGY.verticesPerEntity,
          CURVE_CRAWLER_BODY_TOPOLOGY.indicesPerEntity,
          originX,
          originY,
          0,
        );
        continue;
      }

      const heading = transform.heading[index] ?? 0;
      const headingCosine = Math.cos(heading);
      const headingSine = Math.sin(heading);
      const fragmentScale = Math.max(0.0001, 1 - surfaceCollapse);
      const pulse = 1 + (animation.bodyPulse[index] ?? 0);
      const originalBodyLength = morphology.bodyLength[index] ?? 0;
      const originalBodyWidth = morphology.bodyWidth[index] ?? 0;
      const bodyLength = originalBodyLength * pulse;
      const bodyWidth = originalBodyWidth
        * (1 - (animation.bodyPulse[index] ?? 0) * 0.35
          - (animation.crouchAmount[index] ?? 0) * 0.08);
      const legLength = (morphology.legLength[index] ?? 0)
        * (1 + (animation.crouchAmount[index] ?? 0) * 0.08);
      const legWidth = morphology.legWidth[index] ?? 0;
      const crouchAmount = animation.crouchAmount[index] ?? 0;

      for (let leg = 0; leg < CURVE_CRAWLER_LEG_COUNT; leg++) {
        writeCurveCrawlerLeg(
          writer,
          state,
          index,
          leg,
          headingCosine,
          headingSine,
          bodyLength,
          bodyWidth,
          legLength,
          legWidth,
          fragmentScale,
        );
      }

      const fragmentOffset = index * CURVE_CRAWLER_FRAGMENT_COUNT;
      const abdomenFragment = fragmentOffset + CurveCrawlerFragmentIndex.Abdomen;
      const thoraxFragment = fragmentOffset + CurveCrawlerFragmentIndex.Thorax;
      const abdomenX = originX - headingCosine * bodyLength * 0.15
        + (animation.fragmentOffsetX[abdomenFragment] ?? 0);
      const abdomenY = originY - headingSine * bodyLength * 0.15
        + (animation.fragmentOffsetY[abdomenFragment] ?? 0);
      const thoraxX = originX + headingCosine * bodyLength * 0.28
        + (animation.fragmentOffsetX[thoraxFragment] ?? 0);
      const thoraxY = originY + headingSine * bodyLength * 0.28
        + (animation.fragmentOffsetY[thoraxFragment] ?? 0);

      const abdomenRadiusZ = bodyWidth * 0.42;
      VolumetricTessellator.appendEllipsoid(
        writer,
        abdomenX,
        abdomenY,
        abdomenRadiusZ * (0.92 - crouchAmount * 0.22)
          + (animation.fragmentOffsetZ[abdomenFragment] ?? 0),
        Math.max(bodyLength * 0.48 * fragmentScale, 0.0001),
        Math.max(bodyWidth * 0.52 * fragmentScale, 0.0001),
        Math.max(abdomenRadiusZ * fragmentScale, 0.0001),
        heading + (animation.fragmentRotation[abdomenFragment] ?? 0),
        CURVE_CRAWLER_BODY_LONGITUDE_SEGMENTS,
        CURVE_CRAWLER_BODY_LATITUDE_SEGMENTS,
      );
      const thoraxRadiusZ = bodyWidth * 0.36;
      VolumetricTessellator.appendEllipsoid(
        writer,
        thoraxX,
        thoraxY,
        thoraxRadiusZ * (1.08 - crouchAmount * 0.2)
          + (animation.fragmentOffsetZ[thoraxFragment] ?? 0),
        Math.max(bodyLength * 0.3 * fragmentScale, 0.0001),
        Math.max(bodyWidth * 0.42 * fragmentScale, 0.0001),
        Math.max(thoraxRadiusZ * fragmentScale, 0.0001),
        heading + (animation.fragmentRotation[thoraxFragment] ?? 0),
        CURVE_CRAWLER_BODY_LONGITUDE_SEGMENTS,
        CURVE_CRAWLER_BODY_LATITUDE_SEGMENTS,
      );
    }
  }
}

/** Curve Crawler 身体层的无状态共享写入器。 */
export const curveCrawlerBodyGeometry = new CurveCrawlerBodyGeometrySource();
