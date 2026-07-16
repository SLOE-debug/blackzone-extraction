import { type Material } from 'cc';
import { CurveCrawlerMotionProfile } from './curve-crawler-motion-profile';

/** Curve Crawler 群体使用的二维初始生成区域尺寸。 */
export interface CurveCrawlerSpawnAreaSize {
  readonly width: number;
  readonly height: number;
}

/** 创建 Curve Crawler 群体所需的公开参数。 */
export interface CurveCrawlerPopulationOptions {
  readonly count: number;
  readonly spawnArea: Readonly<CurveCrawlerSpawnAreaSize>;
  readonly seed: number;
  readonly surfaceMaterialTemplate: Material;
}

/** 完成边界校验后的群体参数。 */
export interface NormalizedCurveCrawlerPopulationOptions {
  readonly count: number;
  readonly spawnArea: Readonly<CurveCrawlerSpawnAreaSize>;
  readonly seed: number;
  readonly surfaceMaterialTemplate: Material;
  readonly motionProfile: CurveCrawlerMotionProfile;
}

/**
 * 校验并冻结群体参数，避免各系统重复处理输入边界。
 */
export function normalizeCurveCrawlerOptions(
  options: Readonly<CurveCrawlerPopulationOptions>,
  motionProfile: CurveCrawlerMotionProfile,
): NormalizedCurveCrawlerPopulationOptions {
  if (!Number.isInteger(options.count) || options.count <= 0) {
    throw new Error('Curve Crawler 数量必须是正整数。');
  }
  if (!Number.isFinite(options.spawnArea.width) || options.spawnArea.width <= 0
    || !Number.isFinite(options.spawnArea.height) || options.spawnArea.height <= 0) {
    throw new Error('Curve Crawler 初始生成区域尺寸必须是有限正数。');
  }
  if (!Number.isFinite(options.seed)) {
    throw new Error('Curve Crawler 随机种子必须是有限数值。');
  }
  if (options.surfaceMaterialTemplate.effectAsset === null) {
    throw new Error('Curve Crawler 受光材质模板没有有效 EffectAsset。');
  }

  return Object.freeze({
    count: options.count,
    spawnArea: Object.freeze({
      width: options.spawnArea.width,
      height: options.spawnArea.height,
    }),
    seed: Math.trunc(options.seed),
    surfaceMaterialTemplate: options.surfaceMaterialTemplate,
    motionProfile,
  });
}
