import { WeaponAction } from '../../../../core/equipment/equipment';
import { type BattlefieldHammerActionControlEffect } from './battlefield-facing-lock-effect';
import { getHammerActionControlProfile } from './battlefield-hammer-action-control';

/** 复用单个对象写出动作控制效果，避免高频读取时创建临时快照。 */
export class BattlefieldHammerActionControlSnapshot {
  private readonly effect: Mutable<BattlefieldHammerActionControlEffect> = {
    movementScale: 1,
    facingPolicy: getHammerActionControlProfile(WeaponAction.Idle, 0).facingPolicy,
    maximumTurnSpeed: 0,
    autoTargetAllowed: true,
    damageTakenScale: 1,
    combatInvulnerable: false,
    desiredHeading: 0,
    remainingSeconds: 0,
  };

  /** 根据当前动作状态覆盖并返回同一个只读控制对象。 */
  public write(
    action: WeaponAction,
    progress: number,
    windupMaximumTurnSpeed: number,
    lockedHeading: number,
    spinAngle: number,
    elapsed: number,
    duration: number,
  ): Readonly<BattlefieldHammerActionControlEffect> {
    const profile = getHammerActionControlProfile(action, progress);
    const effect = this.effect;
    effect.movementScale = profile.movementScale;
    effect.facingPolicy = profile.facingPolicy;
    effect.maximumTurnSpeed = action === WeaponAction.WindupLeft
      || action === WeaponAction.WindupRight
      ? Math.max(profile.maximumTurnSpeed, windupMaximumTurnSpeed)
      : profile.maximumTurnSpeed;
    effect.autoTargetAllowed = profile.autoTargetAllowed;
    effect.damageTakenScale = profile.damageTakenScale;
    effect.combatInvulnerable = profile.combatInvulnerable;
    effect.desiredHeading = action === WeaponAction.Spin
      ? lockedHeading + spinAngle
      : lockedHeading;
    effect.remainingSeconds = action === WeaponAction.Idle
      ? 0
      : Math.max(0, duration - elapsed);
    return effect;
  }
}

type Mutable<T> = { -readonly [TKey in keyof T]: T[TKey] };
