/** 主角单帧使用的世界平面移动与瞄准意图。 */
export interface VanguardControlIntent {
  /** 世界 X 轴上的移动输入，完整输入范围为负一至一。 */
  readonly moveX: number;
  /** 世界 Z 轴上的移动输入，完整输入范围为负一至一。 */
  readonly moveZ: number;
  /** 世界 X 轴上的归一化瞄准方向。 */
  readonly aimX: number;
  /** 世界 Z 轴上的归一化瞄准方向。 */
  readonly aimZ: number;
  /** 右摇杆是否正在提供有效瞄准。 */
  readonly aiming: boolean;
}

/** 校验场景写入的控制值，避免无效输入污染连续状态。 */
export function validateVanguardControlIntent(
  intent: Readonly<VanguardControlIntent>,
): void {
  if (!Number.isFinite(intent.moveX)
    || !Number.isFinite(intent.moveZ)
    || !Number.isFinite(intent.aimX)
    || !Number.isFinite(intent.aimZ)) {
    throw new Error('主角移动和瞄准意图必须是有限数值。');
  }
  if (Math.hypot(intent.moveX, intent.moveZ) > 1.0001) {
    throw new Error('主角移动意图长度不能超过一。');
  }
  const aimLength = Math.hypot(intent.aimX, intent.aimZ);
  if (intent.aiming && Math.abs(aimLength - 1) > 0.001) {
    throw new Error('生效的主角瞄准方向必须归一化。');
  }
}
