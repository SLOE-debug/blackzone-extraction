const DEGREES_TO_RADIANS = Math.PI / 180;

/** 右摇杆激活后使用的轻度辅助瞄准参数。 */
export const BATTLEFIELD_AIM_ASSIST = Object.freeze({
  maximumAngleRadians: 6 * DEGREES_TO_RADIANS,
  maximumDistance: 16,
  correctionWeight: 0.3,
  freeAimDistance: 32,
});

/** 辅助瞄准写入的可复用平面方向。 */
export interface MutableBattlefieldAimDirection {
  x: number;
  z: number;
}

/**
 * 把目标方向以最多 30% 权重混入右摇杆方向。
 *
 * @param manualX 右摇杆产生的世界 X 方向。
 * @param manualZ 右摇杆产生的世界 Z 方向。
 * @param assistedX 玩家到候选目标的归一化 X 方向。
 * @param assistedZ 玩家到候选目标的归一化 Z 方向。
 * @param result 复用的最终方向输出。
 */
export function writeSoftAimDirection(
  manualX: number,
  manualZ: number,
  assistedX: number,
  assistedZ: number,
  result: MutableBattlefieldAimDirection,
): void {
  const weight = BATTLEFIELD_AIM_ASSIST.correctionWeight;
  const mixedX = manualX * (1 - weight) + assistedX * weight;
  const mixedZ = manualZ * (1 - weight) + assistedZ * weight;
  const inverseLength = 1 / Math.max(Math.hypot(mixedX, mixedZ), 0.0001);
  result.x = mixedX * inverseLength;
  result.z = mixedZ * inverseLength;
}
