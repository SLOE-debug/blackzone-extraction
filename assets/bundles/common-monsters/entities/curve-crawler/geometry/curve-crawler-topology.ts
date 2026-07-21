import { type FixedTopologyMetrics } from '../../../../../core/geometry/fixed-topology';
import { getFacetedEllipsoidTopologyMetrics } from '../../../../../core/geometry/faceted/faceted-ellipsoid-plan';
import { getFacetedCubicTubeTopologyMetrics } from '../../../../../core/geometry/faceted/faceted-cubic-tube-plan';
import {
  CURVE_CRAWLER_LEG_COUNT,
  CURVE_CRAWLER_LIQUID_RAY_COUNT,
} from '../model/curve-crawler-schema';
import { CURVE_CRAWLER_EMERGENCE_TOPOLOGY } from '../model/curve-crawler-emergence';

export const CURVE_CRAWLER_LEG_SEGMENTS = 6;
export const CURVE_CRAWLER_LEG_RADIAL_SEGMENTS = 4;
export const CURVE_CRAWLER_FOOT_LONGITUDE_SEGMENTS = 5;
export const CURVE_CRAWLER_FOOT_LATITUDE_SEGMENTS = 3;
export const CURVE_CRAWLER_BODY_LONGITUDE_SEGMENTS = 8;
export const CURVE_CRAWLER_BODY_LATITUDE_SEGMENTS = 4;
export const CURVE_CRAWLER_EYE_LONGITUDE_SEGMENTS = 6;
export const CURVE_CRAWLER_EYE_LATITUDE_SEGMENTS = 3;

const LEG_TOPOLOGY = getFacetedCubicTubeTopologyMetrics(
  CURVE_CRAWLER_LEG_SEGMENTS,
  CURVE_CRAWLER_LEG_RADIAL_SEGMENTS,
);
const FOOT_TOPOLOGY = getFacetedEllipsoidTopologyMetrics(
  CURVE_CRAWLER_FOOT_LONGITUDE_SEGMENTS,
  CURVE_CRAWLER_FOOT_LATITUDE_SEGMENTS,
);
const BODY_PART_TOPOLOGY = getFacetedEllipsoidTopologyMetrics(
  CURVE_CRAWLER_BODY_LONGITUDE_SEGMENTS,
  CURVE_CRAWLER_BODY_LATITUDE_SEGMENTS,
);
const EYE_TOPOLOGY = getFacetedEllipsoidTopologyMetrics(
  CURVE_CRAWLER_EYE_LONGITUDE_SEGMENTS,
  CURVE_CRAWLER_EYE_LATITUDE_SEGMENTS,
);
const LIQUID_VERTICES = CURVE_CRAWLER_LIQUID_RAY_COUNT + 1;
const LIQUID_INDICES = CURVE_CRAWLER_LIQUID_RAY_COUNT * 3;
const CRACK_VERTICES = CURVE_CRAWLER_EMERGENCE_TOPOLOGY.crackRayCount
  * CURVE_CRAWLER_EMERGENCE_TOPOLOGY.crackSegmentCount * 6;
const EGG_VERTICES = BODY_PART_TOPOLOGY.indexCount;
const EGG_SHARD_VERTICES = CURVE_CRAWLER_EMERGENCE_TOPOLOGY.eggShardCount
  * CURVE_CRAWLER_EMERGENCE_TOPOLOGY.eggShardFaceVertexCount;

/** Curve Crawler 黑色身体层的固定拓扑。 */
export const CURVE_CRAWLER_BODY_TOPOLOGY = Object.freeze({
  verticesPerEntity: CURVE_CRAWLER_LEG_COUNT * (
    LEG_TOPOLOGY.vertexCount + FOOT_TOPOLOGY.vertexCount
  )
    + BODY_PART_TOPOLOGY.vertexCount * 2,
  indicesPerEntity: CURVE_CRAWLER_LEG_COUNT * (
    LEG_TOPOLOGY.indexCount + FOOT_TOPOLOGY.indexCount
  )
    + BODY_PART_TOPOLOGY.indexCount * 2,
}) satisfies FixedTopologyMetrics;

/** Curve Crawler 双眼层的固定拓扑。 */
export const CURVE_CRAWLER_EYE_TOPOLOGY = Object.freeze({
  verticesPerEntity: EYE_TOPOLOGY.vertexCount * 2,
  indicesPerEntity: EYE_TOPOLOGY.indexCount * 2,
}) satisfies FixedTopologyMetrics;

/** Curve Crawler 死亡液体层的固定扇面拓扑。 */
export const CURVE_CRAWLER_LIQUID_TOPOLOGY = Object.freeze({
  verticesPerEntity: LIQUID_VERTICES,
  indicesPerEntity: LIQUID_INDICES,
}) satisfies FixedTopologyMetrics;

/** Curve Crawler 地裂、分面蛋壳和爆裂碎片的固定出生拓扑。 */
export const CURVE_CRAWLER_EMERGENCE_MESH_TOPOLOGY = Object.freeze({
  verticesPerEntity: CRACK_VERTICES + EGG_VERTICES + EGG_SHARD_VERTICES,
  indicesPerEntity: CRACK_VERTICES + EGG_VERTICES + EGG_SHARD_VERTICES,
}) satisfies FixedTopologyMetrics;

/** Curve Crawler 身体、双眼和死亡液体合并后的单批表面拓扑。 */
export const CURVE_CRAWLER_SURFACE_TOPOLOGY = Object.freeze({
  verticesPerEntity: CURVE_CRAWLER_BODY_TOPOLOGY.verticesPerEntity
    + CURVE_CRAWLER_EYE_TOPOLOGY.verticesPerEntity
    + CURVE_CRAWLER_LIQUID_TOPOLOGY.verticesPerEntity
    + CURVE_CRAWLER_EMERGENCE_MESH_TOPOLOGY.verticesPerEntity,
  indicesPerEntity: CURVE_CRAWLER_BODY_TOPOLOGY.indicesPerEntity
    + CURVE_CRAWLER_EYE_TOPOLOGY.indicesPerEntity
    + CURVE_CRAWLER_LIQUID_TOPOLOGY.indicesPerEntity
    + CURVE_CRAWLER_EMERGENCE_MESH_TOPOLOGY.indicesPerEntity,
}) satisfies FixedTopologyMetrics;
