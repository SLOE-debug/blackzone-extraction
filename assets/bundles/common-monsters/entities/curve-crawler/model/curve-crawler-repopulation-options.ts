/** 玩家周边尸潮维持系统使用的局部平面参数。 */
export interface CurveCrawlerRepopulationOptions {
  readonly centerX: number;
  readonly centerY: number;
  readonly spawnInnerRadius: number;
  readonly spawnOuterRadius: number;
  readonly recycleRadius: number;
  readonly minimumAliveCount: number;
}

/** 校验尸潮环带参数，避免高频回收循环重复处理边界。 */
export function validateCurveCrawlerRepopulationOptions(
  options: Readonly<CurveCrawlerRepopulationOptions>,
  capacity: number,
): void {
  if (!Number.isFinite(options.centerX)
    || !Number.isFinite(options.centerY)
    || !Number.isFinite(options.spawnInnerRadius)
    || !Number.isFinite(options.spawnOuterRadius)
    || !Number.isFinite(options.recycleRadius)
    || options.spawnInnerRadius <= 0
    || options.spawnOuterRadius <= options.spawnInnerRadius
    || options.recycleRadius <= options.spawnOuterRadius
    || !Number.isInteger(options.minimumAliveCount)
    || options.minimumAliveCount <= 0
    || options.minimumAliveCount > capacity) {
    throw new Error('Curve Crawler 尸潮中心、环带半径或最低活体数无效。');
  }
}
