/** Curve Crawler 群体使用的二维活动区域尺寸。 */
export interface CurveCrawlerArenaSize {
  readonly width: number;
  readonly height: number;
}

/** 创建 Curve Crawler 群体所需的公开参数。 */
export interface CurveCrawlerPopulationOptions {
  readonly count: number;
  readonly batchSize: number;
  readonly arena: Readonly<CurveCrawlerArenaSize>;
  readonly seed: number;
}

/** 完成边界校验后的群体参数。 */
export interface NormalizedCurveCrawlerPopulationOptions {
  readonly count: number;
  readonly batchSize: number;
  readonly arena: Readonly<CurveCrawlerArenaSize>;
  readonly seed: number;
}

/**
 * 校验并冻结群体参数，避免各系统重复处理输入边界。
 */
export function normalizeCurveCrawlerOptions(
  options: Readonly<CurveCrawlerPopulationOptions>,
): NormalizedCurveCrawlerPopulationOptions {
  if (!Number.isInteger(options.count) || options.count <= 0) {
    throw new Error('Curve Crawler 数量必须是正整数。');
  }
  if (!Number.isInteger(options.batchSize) || options.batchSize <= 0) {
    throw new Error('Curve Crawler 批容量必须是正整数。');
  }
  if (!Number.isFinite(options.arena.width) || options.arena.width <= 0
    || !Number.isFinite(options.arena.height) || options.arena.height <= 0) {
    throw new Error('Curve Crawler 活动区域尺寸必须是有限正数。');
  }
  if (!Number.isFinite(options.seed)) {
    throw new Error('Curve Crawler 随机种子必须是有限数值。');
  }

  return Object.freeze({
    count: options.count,
    batchSize: options.batchSize,
    arena: Object.freeze({
      width: options.arena.width,
      height: options.arena.height,
    }),
    seed: Math.trunc(options.seed),
  });
}
