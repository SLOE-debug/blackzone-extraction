import { type FixedTopologyMetrics } from '../../../../../core/geometry/fixed-topology';
import { CURVE_CRAWLER_LEG_COUNT } from '../model/curve-crawler-schema';

export const CURVE_CRAWLER_LEG_SEGMENTS = 6;
export const CURVE_CRAWLER_LEG_RADIAL_SEGMENTS = 4;
export const CURVE_CRAWLER_FOOT_LONGITUDE_SEGMENTS = 5;
export const CURVE_CRAWLER_FOOT_LATITUDE_SEGMENTS = 3;
export const CURVE_CRAWLER_BODY_LONGITUDE_SEGMENTS = 8;
export const CURVE_CRAWLER_BODY_LATITUDE_SEGMENTS = 4;
export const CURVE_CRAWLER_EYE_LONGITUDE_SEGMENTS = 6;
export const CURVE_CRAWLER_EYE_LATITUDE_SEGMENTS = 3;

const LEG_VERTICES = (CURVE_CRAWLER_LEG_SEGMENTS + 1) * CURVE_CRAWLER_LEG_RADIAL_SEGMENTS;
const LEG_INDICES = CURVE_CRAWLER_LEG_SEGMENTS * CURVE_CRAWLER_LEG_RADIAL_SEGMENTS * 6;
const FOOT_VERTICES = getEllipsoidVertexCount(
  CURVE_CRAWLER_FOOT_LONGITUDE_SEGMENTS,
  CURVE_CRAWLER_FOOT_LATITUDE_SEGMENTS,
);
const FOOT_INDICES = getEllipsoidIndexCount(
  CURVE_CRAWLER_FOOT_LONGITUDE_SEGMENTS,
  CURVE_CRAWLER_FOOT_LATITUDE_SEGMENTS,
);
const BODY_PART_VERTICES = getEllipsoidVertexCount(
  CURVE_CRAWLER_BODY_LONGITUDE_SEGMENTS,
  CURVE_CRAWLER_BODY_LATITUDE_SEGMENTS,
);
const BODY_PART_INDICES = getEllipsoidIndexCount(
  CURVE_CRAWLER_BODY_LONGITUDE_SEGMENTS,
  CURVE_CRAWLER_BODY_LATITUDE_SEGMENTS,
);
const EYE_VERTICES = getEllipsoidVertexCount(
  CURVE_CRAWLER_EYE_LONGITUDE_SEGMENTS,
  CURVE_CRAWLER_EYE_LATITUDE_SEGMENTS,
);
const EYE_INDICES = getEllipsoidIndexCount(
  CURVE_CRAWLER_EYE_LONGITUDE_SEGMENTS,
  CURVE_CRAWLER_EYE_LATITUDE_SEGMENTS,
);

/** Curve Crawler 黑色身体层的固定拓扑。 */
export const CURVE_CRAWLER_BODY_TOPOLOGY = Object.freeze({
  verticesPerEntity: CURVE_CRAWLER_LEG_COUNT * (LEG_VERTICES + FOOT_VERTICES)
    + BODY_PART_VERTICES * 2,
  indicesPerEntity: CURVE_CRAWLER_LEG_COUNT * (LEG_INDICES + FOOT_INDICES)
    + BODY_PART_INDICES * 2,
}) satisfies FixedTopologyMetrics;

function getEllipsoidVertexCount(longitudeSegments: number, latitudeSegments: number): number {
  return (longitudeSegments + 1) * (latitudeSegments + 1);
}

function getEllipsoidIndexCount(longitudeSegments: number, latitudeSegments: number): number {
  return longitudeSegments * latitudeSegments * 6;
}

/** Curve Crawler 双眼层的固定拓扑。 */
export const CURVE_CRAWLER_EYE_TOPOLOGY = Object.freeze({
  verticesPerEntity: EYE_VERTICES * 2,
  indicesPerEntity: EYE_INDICES * 2,
}) satisfies FixedTopologyMetrics;

/** Curve Crawler 身体和双眼合并后的单批表面拓扑。 */
export const CURVE_CRAWLER_SURFACE_TOPOLOGY = Object.freeze({
  verticesPerEntity: CURVE_CRAWLER_BODY_TOPOLOGY.verticesPerEntity
    + CURVE_CRAWLER_EYE_TOPOLOGY.verticesPerEntity,
  indicesPerEntity: CURVE_CRAWLER_BODY_TOPOLOGY.indicesPerEntity
    + CURVE_CRAWLER_EYE_TOPOLOGY.indicesPerEntity,
}) satisfies FixedTopologyMetrics;
