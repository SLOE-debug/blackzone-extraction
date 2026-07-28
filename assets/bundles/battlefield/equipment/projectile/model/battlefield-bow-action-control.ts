import { VanguardFacingPolicy } from '../../../../../player/vanguard/model/vanguard-facing-policy';
import { type BattlefieldHammerActionControlEffect } from '../../combat/battlefield-facing-lock-effect';
import { BattlefieldBowAction } from './battlefield-bow-action-state';

const BOW_TARGET_TURN_SPEED = Math.PI * 4;

/** 复用单一对象向角色控制层提交猎弓移动与右摇杆朝向。 */
export class BattlefieldBowActionControl {
  private readonly effect: Mutable<BattlefieldHammerActionControlEffect> = {
    movementScale: 1,
    facingPolicy: VanguardFacingPolicy.Free,
    maximumTurnSpeed: BOW_TARGET_TURN_SPEED,
    autoTargetAllowed: false,
    damageTakenScale: 1,
    combatInvulnerable: false,
    desiredHeading: 0,
    remainingSeconds: 0,
  };

  public write(
    action: BattlefieldBowAction,
    desiredHeading: number,
    remainingSeconds: number,
  ): Readonly<BattlefieldHammerActionControlEffect> {
    const effect = this.effect;
    effect.movementScale = getMovementScale(action);
    effect.facingPolicy = action === BattlefieldBowAction.Idle
      ? VanguardFacingPolicy.Free
      : VanguardFacingPolicy.SoftTarget;
    effect.maximumTurnSpeed = BOW_TARGET_TURN_SPEED;
    effect.autoTargetAllowed = false;
    effect.desiredHeading = desiredHeading;
    effect.remainingSeconds = remainingSeconds;
    return effect;
  }
}

function getMovementScale(action: BattlefieldBowAction): number {
  switch (action) {
    case BattlefieldBowAction.Charging:
      return 0.55;
    case BattlefieldBowAction.Recover:
      return 0.85;
    case BattlefieldBowAction.AutoRecalling:
    case BattlefieldBowAction.SkillRecalling:
      return 0.7;
    case BattlefieldBowAction.TetherCast:
      return 0.6;
    case BattlefieldBowAction.Idle:
      return 1;
  }
}

type Mutable<T> = { -readonly [TKey in keyof T]: T[TKey] };
