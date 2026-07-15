import { type FixedTopologyMetrics } from '../../../../../core/geometry/fixed-topology';
import { CURVE_CRAWLER_LEG_COUNT } from '../model/curve-crawler-schema';

export const CURVE_CRAWLER_LEG_SEGMENTS = 14;
export const CURVE_CRAWLER_FOOT_SEGMENTS = 10;
export const CURVE_CRAWLER_BODY_SEGMENTS = 28;
export const CURVE_CRAWLER_EYE_SEGMENTS = 14;

const RIBBON_VERTICES = (CURVE_CRAWLER_LEG_SEGMENTS + 1) * 2;
const RIBBON_INDICES = CURVE_CRAWLER_LEG_SEGMENTS * 6;
const FOOT_VERTICES = CURVE_CRAWLER_FOOT_SEGMENTS + 1;
const FOOT_INDICES = CURVE_CRAWLER_FOOT_SEGMENTS * 3;
const BODY_PART_VERTICES = CURVE_CRAWLER_BODY_SEGMENTS + 1;
const BODY_PART_INDICES = CURVE_CRAWLER_BODY_SEGMENTS * 3;
const EYE_VERTICES = CURVE_CRAWLER_EYE_SEGMENTS + 1;
const EYE_INDICES = CURVE_CRAWLER_EYE_SEGMENTS * 3;

/** Curve Crawler 黑色身体层的固定拓扑。 */
export const CURVE_CRAWLER_BODY_TOPOLOGY = Object.freeze({
  verticesPerEntity: CURVE_CRAWLER_LEG_COUNT * (RIBBON_VERTICES + FOOT_VERTICES)
    + BODY_PART_VERTICES * 2,
  indicesPerEntity: CURVE_CRAWLER_LEG_COUNT * (RIBBON_INDICES + FOOT_INDICES)
    + BODY_PART_INDICES * 2,
}) satisfies FixedTopologyMetrics;

/** Curve Crawler 双眼层的固定拓扑。 */
export const CURVE_CRAWLER_EYE_TOPOLOGY = Object.freeze({
  verticesPerEntity: EYE_VERTICES * 2,
  indicesPerEntity: EYE_INDICES * 2,
}) satisfies FixedTopologyMetrics;
