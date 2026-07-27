/** 大锤专属可升级参数，不污染通用近战武器定义。 */
export interface SledgehammerProgressionStats {
  /** 策划直接理解的目标腾空高度。 */
  readonly uppercutLaunchHeight: number;
  readonly spinDurationSeconds: number;
  readonly spinKnockbackImpulse: number;
  readonly spinPulseIntervalSeconds: number;
  readonly groundSlamReachScale: number;
  readonly groundSlamDamageScale: number;
  readonly groundSlamKnockbackScale: number;
  readonly groundSlamStepStartProgress: number;
  readonly groundSlamStepDurationProgress: number;
  readonly groundSlamStepInputScale: number;
}

/** 当前战场默认的大锤成长参数。 */
export const SLEDGEHAMMER_PROGRESSION = Object.freeze({
  uppercutLaunchHeight: 4.8,
  spinDurationSeconds: 2.6,
  spinKnockbackImpulse: 10.5,
  spinPulseIntervalSeconds: 0.32,
  groundSlamReachScale: 0.68,
  groundSlamDamageScale: 1.48,
  groundSlamKnockbackScale: 1.18,
  groundSlamStepStartProgress: 0.08,
  groundSlamStepDurationProgress: 0.42,
  groundSlamStepInputScale: 0.34,
}) satisfies Readonly<SledgehammerProgressionStats>;

/** 把目标高度转换为给定重力下的垂直初速度。 */
export function calculateLaunchVelocity(
  gravity: number,
  targetHeight: number,
): number {
  if (!Number.isFinite(gravity) || gravity <= 0
    || !Number.isFinite(targetHeight) || targetHeight < 0) {
    throw new Error('大锤腾空重力必须为有限正数，目标高度必须为有限非负数。');
  }
  return Math.sqrt(2 * gravity * targetHeight);
}
