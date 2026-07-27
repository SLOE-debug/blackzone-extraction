import { HTML5, MINIGAME } from 'cc/env';
import {
  getRuntimePerformanceProfile,
  RuntimePerformancePlatform,
} from './runtime-performance-profile';

/** 当前构建目标对应的平台标识，供性能报告稳定记录设备类别。 */
export const RUNTIME_PERFORMANCE_PLATFORM = MINIGAME
  ? RuntimePerformancePlatform.MiniGame
  : HTML5 ? RuntimePerformancePlatform.Web : RuntimePerformancePlatform.Native;

/** 当前构建目标使用的类型化性能配置。 */
export const RUNTIME_PERFORMANCE_PROFILE = getRuntimePerformanceProfile(
  RUNTIME_PERFORMANCE_PLATFORM,
);
