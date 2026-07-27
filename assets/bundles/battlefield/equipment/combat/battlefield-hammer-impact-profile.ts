import { BattlefieldWeaponHitKind } from './battlefield-combat-event-buffer';
import { SLEDGEHAMMER_PROGRESSION } from '../items/sledgehammer/sledgehammer-progression';
import { type SledgehammerSpinKnockbackValues } from '../items/sledgehammer/sledgehammer-spin-knockback-tuning';

/** 返回不同大锤命中事件相对基础伤害的倍率。 */
export function getHammerDamageScale(
  kind: BattlefieldWeaponHitKind,
  spinTargetHitCount = 1,
): number {
  switch (kind) {
    case BattlefieldWeaponHitKind.Swing:
      return 1;
    case BattlefieldWeaponHitKind.Uppercut:
      return SLEDGEHAMMER_PROGRESSION.uppercutDamageScale;
    case BattlefieldWeaponHitKind.GroundSlam:
      return SLEDGEHAMMER_PROGRESSION.groundSlamDamageScale;
    case BattlefieldWeaponHitKind.SpinPulse:
      return calculateSpinPulseDamageScale(spinTargetHitCount);
    case BattlefieldWeaponHitKind.SpinFinal:
      return SLEDGEHAMMER_PROGRESSION.spinFinalDamageScale;
  }
}

/** 返回不同大锤命中事件的初始击退速度。 */
export function getHammerKnockbackSpeed(
  kind: BattlefieldWeaponHitKind,
  baseImpulse: number,
  spinProgress: number,
  spinKnockback: Readonly<SledgehammerSpinKnockbackValues>,
): number {
  switch (kind) {
    case BattlefieldWeaponHitKind.Swing:
      return baseImpulse;
    case BattlefieldWeaponHitKind.Uppercut:
      return baseImpulse * 0.35;
    case BattlefieldWeaponHitKind.GroundSlam:
      return baseImpulse * SLEDGEHAMMER_PROGRESSION.groundSlamKnockbackScale;
    case BattlefieldWeaponHitKind.SpinPulse:
      return spinKnockback.impulse
        * calculateSpinPulseKnockbackScale(spinProgress, spinKnockback);
    case BattlefieldWeaponHitKind.SpinFinal:
      return spinKnockback.impulse * spinKnockback.finalScale;
  }
}

/** 根据同一旋风对单个目标的命中次数递增脉冲伤害。 */
export function calculateSpinPulseDamageScale(targetHitCount: number): number {
  if (!Number.isSafeInteger(targetHitCount) || targetHitCount <= 0) {
    throw new Error('旋风目标命中次数必须是正安全整数。');
  }
  const progression = SLEDGEHAMMER_PROGRESSION;
  const repeatBonus = Math.min(
    (targetHitCount - 1) * progression.spinRepeatDamageStep,
    progression.spinRepeatDamageMaximumBonus,
  );
  return progression.spinPulseBaseDamageScale + repeatBonus;
}

/** 前段保留怪物，随后按旋风进度平方增强径向击退。 */
export function calculateSpinPulseKnockbackScale(
  spinProgress: number,
  spinKnockback: Readonly<SledgehammerSpinKnockbackValues>,
): number {
  if (!Number.isFinite(spinProgress)) {
    throw new Error('旋风进度必须是有限数值。');
  }
  const progress = Math.max(0, Math.min(1, spinProgress));
  return spinKnockback.pulseMinimumScale
    + (spinKnockback.pulseMaximumScale - spinKnockback.pulseMinimumScale)
      * progress * progress;
}
