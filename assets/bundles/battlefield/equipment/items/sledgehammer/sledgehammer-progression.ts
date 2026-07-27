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
  readonly spinKnockbackDurationSeconds: number;
  readonly spinPulseMinimumKnockbackScale: number;
  readonly spinPulseMaximumKnockbackScale: number;
  readonly spinFinalKnockbackScale: number;
  readonly spinPulseBaseDamageScale: number;
  readonly spinRepeatDamageStep: number;
  readonly spinRepeatDamageMaximumBonus: number;
  readonly spinFinalDamageScale: number;
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
  spinKnockbackImpulse: 13.5,
  spinKnockbackCombineMode: PlanarKnockbackCombineMode.Accumulate,
  spinMaximumKnockbackSpeed: 38,
  spinKnockbackDurationSeconds: 0.4,
  spinPulseMinimumKnockbackScale: 0.72,
  spinPulseMaximumKnockbackScale: 1.08,
  spinFinalKnockbackScale: 1.65,
  spinPulseBaseDamageScale: 0.42,
  spinRepeatDamageStep: 0.06,
  spinRepeatDamageMaximumBonus: 0.24,
  spinFinalDamageScale: 1.05,
  groundSlamReachScale: 0.68,
  groundSlamDamageScale: 1.48,
  groundSlamKnockbackScale: 1.18,
  groundSlamStepStartProgress: 0.08,
  groundSlamStepDurationProgress: 0.42,
  groundSlamStepInputScale: 0.34,
}) satisfies Readonly<SledgehammerProgressionStats>;
