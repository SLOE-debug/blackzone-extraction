import { PlanarKnockbackCombineMode } from '../../../../../core/contracts/monster-effects';

/** 大锤专属可升级参数，不污染通用近战武器定义。 */
export interface SledgehammerProgressionStats {
  readonly uppercutReachScale: number;
  readonly uppercutArcRadians: number;
  /** 策划直接理解的目标腾空高度。 */
  readonly uppercutLaunchHeight: number;
  readonly uppercutHorizontalSpeed: number;
  readonly uppercutHorizontalDrag: number;
  readonly uppercutDamageScale: number;
  readonly spinDurationSeconds: number;
  readonly spinRevolutions: number;
  readonly spinMovementScale: number;
  readonly spinStartupSeconds: number;
  readonly spinRecoverySeconds: number;
  readonly spinHitWindowAngle: number;
  readonly spinSweepSubstepAngle: number;
  readonly spinMaximumSweepSubsteps: number;
  readonly spinKnockbackImpulse: number;
  readonly spinKnockbackCombineMode: PlanarKnockbackCombineMode;
  readonly spinMaximumKnockbackSpeed: number;
  readonly spinPulseKnockbackScale: number;
  readonly spinFinalKnockbackScale: number;
  readonly groundSlamReachScale: number;
  readonly groundSlamDamageScale: number;
  readonly groundSlamKnockbackScale: number;
  readonly groundSlamStepStartProgress: number;
  readonly groundSlamStepDurationProgress: number;
  readonly groundSlamStepInputScale: number;
}

/** 当前战场默认的大锤成长参数。 */
export const SLEDGEHAMMER_PROGRESSION = Object.freeze({
  uppercutReachScale: 1.08,
  uppercutArcRadians: Math.PI * 0.72,
  uppercutLaunchHeight: 4.2,
  uppercutHorizontalSpeed: 9.2,
  uppercutHorizontalDrag: 1.15,
  uppercutDamageScale: 1.2,
  spinDurationSeconds: 1.45,
  spinRevolutions: 4,
  spinMovementScale: 0.62,
  spinStartupSeconds: 0.1,
  spinRecoverySeconds: 0.15,
  spinHitWindowAngle: Math.PI,
  spinSweepSubstepAngle: Math.PI / 12,
  spinMaximumSweepSubsteps: 4,
  spinKnockbackImpulse: 10.5,
  spinKnockbackCombineMode: PlanarKnockbackCombineMode.Accumulate,
  spinMaximumKnockbackSpeed: 28,
  spinPulseKnockbackScale: 0.62,
  spinFinalKnockbackScale: 1.28,
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
