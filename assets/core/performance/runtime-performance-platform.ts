import { HTML5, MINIGAME } from 'cc/env';
import {
  getRuntimePerformanceProfile,
  RuntimePerformancePlatform,
} from './runtime-performance-profile';

/** 当前构建目标使用的类型化性能配置。 */
export const RUNTIME_PERFORMANCE_PROFILE = getRuntimePerformanceProfile(
  MINIGAME
    ? RuntimePerformancePlatform.MiniGame
    : HTML5 ? RuntimePerformancePlatform.Web : RuntimePerformancePlatform.Native,
);
