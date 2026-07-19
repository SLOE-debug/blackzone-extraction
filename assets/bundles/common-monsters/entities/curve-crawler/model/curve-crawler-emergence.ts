/** Curve Crawler 出生演出的确定性阶段时长，单位为秒。 */
export const CURVE_CRAWLER_EMERGENCE_TIMING = Object.freeze({
  staggerPerEntity: 0.16,
  maximumStaggerJitter: 0.18,
  crackSeconds: 0.68,
  eggGrowthSeconds: 0.82,
  eggBulgeSeconds: 0.58,
  eggBurstSeconds: 0.34,
  limbGrowthSeconds: 1.28,
});

/** Curve Crawler 出生演出使用的固定低密度拓扑数量。 */
export const CURVE_CRAWLER_EMERGENCE_TOPOLOGY = Object.freeze({
  crackRayCount: 7,
  crackSegmentCount: 3,
  eggShardCount: 9,
  eggShardFaceVertexCount: 12,
});
