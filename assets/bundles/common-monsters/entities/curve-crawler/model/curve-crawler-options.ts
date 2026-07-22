import { type Material } from 'cc';
import { type CurveCrawlerCombatOptions } from './curve-crawler-combat-options';
import { CurveCrawlerMotionProfile } from './curve-crawler-motion-profile';

/** Curve Crawler 群体使用的二维初始生成区域。 */
export interface CurveCrawlerSpawnArea {
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
}

/** 创建无自主战斗逻辑的 Curve Crawler 展示群体所需的公开参数。 */
export interface CurveCrawlerDisplayOptions {
  readonly count: number;
  readonly spawnArea: Readonly<CurveCrawlerSpawnArea>;
  readonly seed: number;
  readonly surfaceMaterialTemplate: Material;
}

/** 创建自主战斗 Curve Crawler 群体所需的公开参数。 */
export interface CurveCrawlerPopulationOptions extends CurveCrawlerDisplayOptions {
  readonly combat: Readonly<CurveCrawlerCombatOptions>;
  /** 创建时立即进入出生状态的槽位数；零表示由外部人口系统逐步激活。 */
  readonly initialPopulationCount: number;
}

/** 完成边界校验后的群体参数。 */
export interface NormalizedCurveCrawlerPopulationOptions {
  readonly count: number;
  readonly spawnArea: Readonly<CurveCrawlerSpawnArea>;
  readonly seed: number;
  readonly surfaceMaterialTemplate: Material;
  readonly motionProfile: CurveCrawlerMotionProfile;
  readonly initialPopulationCount: number;
}

/** 领域状态初始化真正消费的参数，不携带 Rendering 专用材质资源。 */
export type CurveCrawlerStateOptions = Omit<
  NormalizedCurveCrawlerPopulationOptions,
  'surfaceMaterialTemplate'
>;

/**
 * 校验并冻结群体参数，避免各系统重复处理输入边界。
 */
export function normalizeCurveCrawlerOptions(
  options: Readonly<CurveCrawlerDisplayOptions | CurveCrawlerPopulationOptions>,
  motionProfile: CurveCrawlerMotionProfile,
): NormalizedCurveCrawlerPopulationOptions {
  if (!Number.isInteger(options.count) || options.count <= 0) {
    throw new Error('Curve Crawler 数量必须是正整数。');
  }
  if (!Number.isFinite(options.spawnArea.centerX)
    || !Number.isFinite(options.spawnArea.centerY)
    || !Number.isFinite(options.spawnArea.width) || options.spawnArea.width <= 0
    || !Number.isFinite(options.spawnArea.height) || options.spawnArea.height <= 0) {
    throw new Error('Curve Crawler 初始生成区域必须使用有限中心和正尺寸。');
  }
  if (!Number.isFinite(options.seed)) {
    throw new Error('Curve Crawler 随机种子必须是有限数值。');
  }
  const initialPopulationCount = motionProfile === CurveCrawlerMotionProfile.Autonomous
    ? readInitialPopulationCount(options)
    : options.count;
  if (options.surfaceMaterialTemplate.effectAsset === null) {
    throw new Error('Curve Crawler 受光材质模板没有有效 EffectAsset。');
  }

  return Object.freeze({
    count: options.count,
    spawnArea: Object.freeze({
      centerX: options.spawnArea.centerX,
      centerY: options.spawnArea.centerY,
      width: options.spawnArea.width,
      height: options.spawnArea.height,
    }),
    seed: Math.trunc(options.seed),
    surfaceMaterialTemplate: options.surfaceMaterialTemplate,
    motionProfile,
    initialPopulationCount,
  });
}

/** 读取自主群体显式声明的初始驻留数量，不为旧调用隐式补默认值。 */
function readInitialPopulationCount(
  options: Readonly<CurveCrawlerDisplayOptions>,
): number {
  if (!('initialPopulationCount' in options)
    || typeof options.initialPopulationCount !== 'number'
    || !Number.isInteger(options.initialPopulationCount)
    || options.initialPopulationCount < 0
    || options.initialPopulationCount > options.count) {
    throw new Error('自主 Curve Crawler 初始人口必须位于零到群体容量之间。');
  }
  return options.initialPopulationCount;
}
