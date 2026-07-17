import { type AdaptiveRenderScaleOptions } from './adaptive-render-scale';

/** 运行平台使用的稳定性能策略标识。 */
export enum RuntimePerformancePlatform {
  Web = 'web',
  MiniGame = 'mini-game',
  Native = 'native',
}

/** 单个运行平台使用的帧调度、像素预算与动态分辨率策略。 */
export interface RuntimePerformanceProfile extends AdaptiveRenderScaleOptions {
  readonly schedulerFrameRate: number;
  readonly maximumInitialPixelCount: number;
}

const COMMON_ADAPTIVE_OPTIONS = Object.freeze({
  decreaseStep: 0.1,
  criticalDecreaseStep: 0.2,
  criticalFrameRate: 40,
  increaseStep: 0.05,
  slowFrameRate: 55,
  recoveryFrameRate: 59,
  sampleDuration: 0.75,
  recoverySampleCount: 4,
  recoveryProbeGraceSampleCount: 1,
  discardedDeltaTime: 0.2,
});

/**
 * Web Pacer 略高于常见 60Hz 刷新率，避免同频整数边界把有效 rAF 判为过早帧。
 */
const WEB_PROFILE = Object.freeze({
  ...COMMON_ADAPTIVE_OPTIONS,
  schedulerFrameRate: 61,
  maximumInitialPixelCount: 1_200_000,
  initialScale: 0.85,
  minimumScale: 0.5,
  maximumScale: 1,
}) satisfies RuntimePerformanceProfile;

/** 微信与抖音小游戏优先稳定帧时间，并限制高 DPR 设备的首屏像素开销。 */
const MINI_GAME_PROFILE = Object.freeze({
  ...COMMON_ADAPTIVE_OPTIONS,
  schedulerFrameRate: 60,
  maximumInitialPixelCount: 900_000,
  initialScale: 0.7,
  minimumScale: 0.5,
  maximumScale: 0.8,
}) satisfies RuntimePerformanceProfile;

/** 原生平台保留更高清晰度，并在持续掉帧时快速降档。 */
const NATIVE_PROFILE = Object.freeze({
  ...COMMON_ADAPTIVE_OPTIONS,
  schedulerFrameRate: 60,
  maximumInitialPixelCount: 2_000_000,
  initialScale: 1,
  minimumScale: 0.65,
  maximumScale: 1,
}) satisfies RuntimePerformanceProfile;

const PROFILE_BY_PLATFORM = Object.freeze({
  [RuntimePerformancePlatform.Web]: WEB_PROFILE,
  [RuntimePerformancePlatform.MiniGame]: MINI_GAME_PROFILE,
  [RuntimePerformancePlatform.Native]: NATIVE_PROFILE,
}) satisfies Readonly<Record<RuntimePerformancePlatform, RuntimePerformanceProfile>>;

/** 返回指定运行平台的只读性能配置。 */
export function getRuntimePerformanceProfile(
  platform: RuntimePerformancePlatform,
): RuntimePerformanceProfile {
  return PROFILE_BY_PLATFORM[platform];
}
