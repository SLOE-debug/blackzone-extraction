import { HTML5, MINIGAME } from 'cc/env';
import { type AdaptiveRenderScaleOptions } from './adaptive-render-scale';

/** 单个运行平台使用的帧率与分辨率策略。 */
export interface RuntimePerformanceProfile extends AdaptiveRenderScaleOptions {
  readonly targetFrameRate: number;
}

const COMMON_ADAPTIVE_OPTIONS = Object.freeze({
  decreaseStep: 0.1,
  increaseStep: 0.05,
  slowFrameRate: 55,
  recoveryFrameRate: 59,
  sampleDuration: 0.75,
  recoverySampleCount: 4,
  discardedDeltaTime: 0.2,
});

/** 浏览器正式运行时优先保持清晰度，在持续低于 55 FPS 时逐级降分辨率。 */
const WEB_PROFILE = Object.freeze({
  ...COMMON_ADAPTIVE_OPTIONS,
  targetFrameRate: 60,
  initialScale: 1,
  minimumScale: 0.65,
  maximumScale: 1,
}) satisfies RuntimePerformanceProfile;

/** 微信与抖音小游戏优先稳定帧时间，限制高 DPR 设备的像素开销。 */
const MINI_GAME_PROFILE = Object.freeze({
  ...COMMON_ADAPTIVE_OPTIONS,
  targetFrameRate: 60,
  initialScale: 0.72,
  minimumScale: 0.55,
  maximumScale: 0.82,
}) satisfies RuntimePerformanceProfile;

/** 原生平台默认使用完整分辨率，仅在持续掉帧时降档。 */
const NATIVE_PROFILE = Object.freeze({
  ...COMMON_ADAPTIVE_OPTIONS,
  targetFrameRate: 60,
  initialScale: 1,
  minimumScale: 0.75,
  maximumScale: 1,
}) satisfies RuntimePerformanceProfile;

/** 当前构建目标使用的类型化性能配置。 */
export const RUNTIME_PERFORMANCE_PROFILE: RuntimePerformanceProfile = MINIGAME
  ? MINI_GAME_PROFILE
  : HTML5 ? WEB_PROFILE : NATIVE_PROFILE;
