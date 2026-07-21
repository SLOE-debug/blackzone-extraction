const HIT_FLASH_BAND_COUNT = 4;
const LIQUID_DRAIN_BAND_COUNT = 6;

/** 把连续受击强度压成少量分面色阶，避免每帧重传整个共享 Color 流。 */
export function quantizeCurveCrawlerHitFlash(value: number): number {
  return quantizeUnitSignal(value, HIT_FLASH_BAND_COUNT);
}

/** 把液化颜色压成稳定色阶，使死亡演出保留变化但不会逐帧刷新大缓冲。 */
export function quantizeCurveCrawlerLiquidDrain(value: number): number {
  return quantizeUnitSignal(value, LIQUID_DRAIN_BAND_COUNT);
}

function quantizeUnitSignal(value: number, bandCount: number): number {
  const clamped = Math.max(0, Math.min(value, 1));
  return Math.round(clamped * bandCount) / bandCount;
}
