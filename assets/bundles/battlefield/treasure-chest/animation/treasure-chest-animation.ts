/** 宝箱开启动画的固定时序。 */
export const TREASURE_CHEST_ANIMATION = Object.freeze({
  duration: 1.08,
  lootReleaseTime: 0.46,
  overshootAngleDegrees: -116,
  finalAngleDegrees: -108,
});

/**
 * 求值先快速抬升、轻微越界后柔和回落的箱盖角度。
 *
 * @param elapsed 从开始开箱起经过的秒数。
 */
export function evaluateTreasureChestLidAngle(elapsed: number): number {
  if (!Number.isFinite(elapsed)) {
    throw new Error('宝箱动画时间必须是有限数值。');
  }
  const normalized = Math.max(0, Math.min(1, elapsed / TREASURE_CHEST_ANIMATION.duration));
  const overshootEnd = 0.72;
  if (normalized <= overshootEnd) {
    const amount = smootherStep(normalized / overshootEnd);
    return TREASURE_CHEST_ANIMATION.overshootAngleDegrees * amount;
  }
  const settle = smootherStep((normalized - overshootEnd) / (1 - overshootEnd));
  return TREASURE_CHEST_ANIMATION.overshootAngleDegrees
    + (TREASURE_CHEST_ANIMATION.finalAngleDegrees
      - TREASURE_CHEST_ANIMATION.overshootAngleDegrees) * settle;
}

function smootherStep(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}
