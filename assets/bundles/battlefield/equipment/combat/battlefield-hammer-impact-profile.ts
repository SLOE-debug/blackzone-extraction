import { BattlefieldWeaponHitKind } from './battlefield-combat-event-buffer';
import { SLEDGEHAMMER_PROGRESSION } from '../items/sledgehammer/sledgehammer-progression';

/** 返回不同大锤命中事件相对基础伤害的倍率。 */
export function getHammerDamageScale(kind: BattlefieldWeaponHitKind): number {
  switch (kind) {
    case BattlefieldWeaponHitKind.Swing:
      return 1;
    case BattlefieldWeaponHitKind.Uppercut:
      return SLEDGEHAMMER_PROGRESSION.uppercutDamageScale;
    case BattlefieldWeaponHitKind.GroundSlam:
      return SLEDGEHAMMER_PROGRESSION.groundSlamDamageScale;
    case BattlefieldWeaponHitKind.SpinPulse:
      return 0.34;
    case BattlefieldWeaponHitKind.SpinFinal:
      return 0.88;
  }
}

/** 返回不同大锤命中事件的初始击退速度。 */
export function getHammerKnockbackSpeed(
  kind: BattlefieldWeaponHitKind,
  baseImpulse: number,
): number {
  switch (kind) {
    case BattlefieldWeaponHitKind.Swing:
      return baseImpulse;
    case BattlefieldWeaponHitKind.Uppercut:
      return baseImpulse * 0.35;
    case BattlefieldWeaponHitKind.GroundSlam:
      return baseImpulse * SLEDGEHAMMER_PROGRESSION.groundSlamKnockbackScale;
    case BattlefieldWeaponHitKind.SpinPulse:
      return SLEDGEHAMMER_PROGRESSION.spinKnockbackImpulse
        * SLEDGEHAMMER_PROGRESSION.spinPulseKnockbackScale;
    case BattlefieldWeaponHitKind.SpinFinal:
      return SLEDGEHAMMER_PROGRESSION.spinKnockbackImpulse
        * SLEDGEHAMMER_PROGRESSION.spinFinalKnockbackScale;
  }
}
