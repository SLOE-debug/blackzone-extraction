/** Curve Crawler 从存活到液体消失的生命周期阶段。 */
export enum CurveCrawlerLifePhase {
  Alive,
  Bursting,
  Liquefying,
  Gone,
}

/** Curve Crawler 默认最大生命值。 */
export const CURVE_CRAWLER_MAX_HEALTH = 100;

/** 单次受击闪烁持续时间，单位为秒。 */
export const CURVE_CRAWLER_HIT_FLASH_DURATION = 0.34;

/** 身体爆裂并转化为液体的持续时间，单位为秒。 */
export const CURVE_CRAWLER_BURST_DURATION = 0.72;

/** 液体停留、下移并完全消失的持续时间，单位为秒。 */
export const CURVE_CRAWLER_LIQUID_DURATION = 2.6;
