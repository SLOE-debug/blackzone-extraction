/** 玩家周边 Venom Lobber 专家怪物的环带生成参数。 */
export interface VenomLobberRepopulationOptions {
  readonly centerX: number;
  readonly centerY: number;
  readonly spawnInnerRadius: number;
  readonly spawnOuterRadius: number;
  readonly recycleRadius: number;
  readonly hardRecycleRadius: number;
  readonly desiredPopulationCount: number;
}

/** 校验外部波次系统写入的环带边界。 */
export function validateVenomLobberRepopulationOptions(
  options: Readonly<VenomLobberRepopulationOptions>,
  capacity: number,
): void {
  if (!Number.isFinite(options.centerX)
    || !Number.isFinite(options.centerY)
    || !Number.isFinite(options.spawnInnerRadius)
    || !Number.isFinite(options.spawnOuterRadius)
    || !Number.isFinite(options.recycleRadius)
    || !Number.isFinite(options.hardRecycleRadius)
    || options.spawnInnerRadius <= 0
    || options.spawnOuterRadius <= options.spawnInnerRadius
    || options.recycleRadius <= options.spawnOuterRadius
    || options.hardRecycleRadius <= options.recycleRadius
    || !Number.isInteger(options.desiredPopulationCount)
    || options.desiredPopulationCount < 0
    || options.desiredPopulationCount > capacity) {
    throw new Error('Venom Lobber 环带或目标人口配置无效。');
  }
}
