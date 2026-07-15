import { type EntityRange } from '../../../../../core/entities/entity-range';
import { type FixedTopologyGeometrySource } from '../../../../../core/geometry/fixed-topology';
import { type TriangleMeshWriter } from '../../../../../core/geometry/triangle-mesh-writer';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { curveCrawlerBodyGeometry } from './curve-crawler-body-geometry';
import { curveCrawlerEyeGeometry } from './curve-crawler-eye-geometry';
import { curveCrawlerLiquidGeometry } from './curve-crawler-liquid-geometry';
import { CURVE_CRAWLER_SURFACE_TOPOLOGY } from './curve-crawler-topology';

/** 将身体和双眼按稳定顺序写入同一份固定拓扑表面。 */
export class CurveCrawlerSurfaceGeometrySource
implements FixedTopologyGeometrySource<CurveCrawlerState> {
  public readonly metrics = CURVE_CRAWLER_SURFACE_TOPOLOGY;

  /** 先写入全部身体、双眼和液体，供单材质单批次渲染。 */
  public write(writer: TriangleMeshWriter, state: CurveCrawlerState, range: EntityRange): void {
    curveCrawlerBodyGeometry.write(writer, state, range);
    curveCrawlerEyeGeometry.write(writer, state, range);
    curveCrawlerLiquidGeometry.write(writer, state, range);
  }
}

/** Curve Crawler 合并表面的无状态共享写入器。 */
export const curveCrawlerSurfaceGeometry = new CurveCrawlerSurfaceGeometrySource();
