/** 加载遮罩显示的归一化阶段进度。 */
export interface LoadingProgress {
  /** 零到一之间的阶段完成度。 */
  readonly ratio: number;
  /** 当前阶段向玩家展示的中文说明。 */
  readonly message: string;
}

/** 接收场景或 Feature 加载阶段进度。 */
export type LoadingProgressReporter = (progress: Readonly<LoadingProgress>) => void;

/** 创建经过边界校验的加载进度。 */
export function createLoadingProgress(ratio: number, message: string): LoadingProgress {
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
    throw new Error('加载进度必须位于零到一之间。');
  }
  if (message.trim().length === 0) {
    throw new Error('加载阶段说明不能为空。');
  }
  return Object.freeze({ ratio, message });
}
