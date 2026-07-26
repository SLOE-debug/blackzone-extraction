import { WeaponAction, type MeleeWeaponDefinition } from '../../../../core/equipment/equipment';
import {
  BattlefieldFacingLockSource,
  type BattlefieldFacingLockEffect,
} from './battlefield-facing-lock-effect';

const SWING_WINDUP_SECONDS = 0.18;
const SWING_CONTACT_SECONDS = 0.14;
const UPPERCUT_CONTACT_TIME = 0.2;
const UPPERCUT_DURATION = 0.64;
const HIT_STOP_SECONDS = 0.045;

/** 单次动作更新产生的无分配事件快照。 */
export interface MutableHammerActionEvents {
  swingImpact: boolean;
  uppercutImpact: boolean;
  spinPulse: boolean;
  spinFinal: boolean;
}

/** 管理左右交替挥动、五连击震势与两种特殊攻击时间轴。 */
export class BattlefieldHammerActionState {
  private actionValue = WeaponAction.Idle;
  private elapsed = 0;
  private duration = 1;
  private impactEmitted = false;
  private nextSpinPulseTime = 0;
  private attackSequenceValue = 0;
  private skillSequenceValue = 0;
  private alternateLeft = true;
  private lastRequestedRight: boolean | null = null;
  private directionXValue = 0;
  private directionZValue = 1;
  private hitCountValue = 0;
  private momentumChargesValue = 0;
  private comboRemaining = 0;
  private hitStopRemaining = 0;
  private lockedHeading = 0;
  private readonly facingLockEffect: {
    source: BattlefieldFacingLockSource;
    lockedHeading: number;
    remainingSeconds: number;
  } = {
    source: BattlefieldFacingLockSource.HammerSpin,
    lockedHeading: 0,
    remainingSeconds: 0,
  };

  public get action(): WeaponAction {
    return this.actionValue;
  }

  public get progress(): number {
    return Math.max(0, Math.min(1, this.elapsed / Math.max(this.duration, 0.0001)));
  }

  public get directionX(): number {
    return this.directionXValue;
  }

  public get directionZ(): number {
    return this.directionZValue;
  }

  public get attackSequenceId(): number {
    return this.attackSequenceValue;
  }

  public get skillSequenceId(): number {
    return this.skillSequenceValue;
  }

  public get hitCount(): number {
    return this.hitCountValue;
  }

  public get momentumCharges(): number {
    return this.momentumChargesValue;
  }

  public get facingLock(): Readonly<BattlefieldFacingLockEffect> | null {
    if (this.actionValue !== WeaponAction.Spin) {
      return null;
    }
    this.facingLockEffect.lockedHeading = this.lockedHeading;
    this.facingLockEffect.remainingSeconds = Math.max(0, this.duration - this.elapsed);
    return this.facingLockEffect;
  }

  public requestSwing(
    directionX: number,
    directionZ: number,
    startsRight: boolean | null = null,
  ): boolean {
    if (!this.canStartAction()) {
      return false;
    }
    const startLeft = startsRight === null
      ? this.alternateLeft
      : this.lastRequestedRight === startsRight
        ? this.alternateLeft
        : !startsRight;
    this.beginAction(
      startLeft ? WeaponAction.WindupLeft : WeaponAction.WindupRight,
      SWING_WINDUP_SECONDS,
      directionX,
      directionZ,
    );
    this.alternateLeft = !startLeft;
    this.lastRequestedRight = startsRight;
    return true;
  }

  public requestUppercut(heading: number): boolean {
    if (!this.canStartAction() || !this.consumeMomentum()) {
      return false;
    }
    this.beginAction(WeaponAction.Uppercut, UPPERCUT_DURATION, Math.sin(heading), Math.cos(heading));
    return true;
  }

  public requestSpin(heading: number, spinDurationSeconds: number): boolean {
    if (!this.canStartAction() || !this.consumeMomentum()) {
      return false;
    }
    this.beginAction(
      WeaponAction.Spin,
      Math.max(2, Math.min(3, spinDurationSeconds)),
      Math.sin(heading),
      Math.cos(heading),
    );
    this.lockedHeading = heading;
    this.skillSequenceValue = nextSequence(this.skillSequenceValue);
    this.nextSpinPulseTime = 0.16;
    return true;
  }

  /** 推进动作并写出当前帧唯一命中或脉冲事件。 */
  public update(
    deltaTime: number,
    definition: Readonly<MeleeWeaponDefinition>,
    spinPulseInterval: number,
    result: MutableHammerActionEvents,
  ): void {
    resetEvents(result);
    this.comboRemaining = Math.max(0, this.comboRemaining - deltaTime);
    if (this.comboRemaining <= 0 && this.hitCountValue > 0) {
      this.hitCountValue = 0;
    }
    if (this.hitStopRemaining > 0) {
      this.hitStopRemaining = Math.max(0, this.hitStopRemaining - deltaTime);
      return;
    }
    this.elapsed += deltaTime;
    switch (this.actionValue) {
      case WeaponAction.WindupLeft:
        if (this.elapsed >= this.duration) {
          this.beginAction(
            WeaponAction.SwingLeft,
            SWING_CONTACT_SECONDS,
            this.directionXValue,
            this.directionZValue,
            false,
          );
          result.swingImpact = true;
          this.impactEmitted = true;
        }
        break;
      case WeaponAction.WindupRight:
        if (this.elapsed >= this.duration) {
          this.beginAction(
            WeaponAction.SwingRight,
            SWING_CONTACT_SECONDS,
            this.directionXValue,
            this.directionZValue,
            false,
          );
          result.swingImpact = true;
          this.impactEmitted = true;
        }
        break;
      case WeaponAction.SwingLeft:
      case WeaponAction.SwingRight:
        if (this.elapsed >= this.duration) {
          this.beginAction(
            WeaponAction.Recover,
            Math.max(0.08, definition.attackIntervalSeconds
              - SWING_WINDUP_SECONDS - SWING_CONTACT_SECONDS),
            this.directionXValue,
            this.directionZValue,
            false,
          );
        }
        break;
      case WeaponAction.Uppercut:
        if (!this.impactEmitted && this.elapsed >= UPPERCUT_CONTACT_TIME) {
          this.impactEmitted = true;
          result.uppercutImpact = true;
        }
        if (this.elapsed >= this.duration) {
          this.finishAction();
        }
        break;
      case WeaponAction.Spin:
        if (this.elapsed >= this.nextSpinPulseTime && this.elapsed < this.duration - 0.04) {
          this.attackSequenceValue = nextSequence(this.attackSequenceValue);
          result.spinPulse = true;
          this.nextSpinPulseTime += spinPulseInterval;
        }
        if (this.elapsed >= this.duration) {
          this.attackSequenceValue = nextSequence(this.attackSequenceValue);
          result.spinFinal = true;
          this.finishAction();
        }
        break;
      case WeaponAction.Recover:
        if (this.elapsed >= this.duration) {
          this.finishAction();
        }
        break;
      case WeaponAction.Idle:
        break;
    }
  }

  /** 每次确认至少命中一个怪物时只增加一次连击。 */
  public recordConfirmedAttack(definition: Readonly<MeleeWeaponDefinition>): void {
    this.hitCountValue++;
    this.comboRemaining = definition.comboWindowSeconds;
    this.hitStopRemaining = HIT_STOP_SECONDS;
    if (this.hitCountValue >= definition.specialRequiredHits) {
      this.hitCountValue = 0;
      this.momentumChargesValue = 1;
    }
  }

  private canStartAction(): boolean {
    return this.actionValue === WeaponAction.Idle;
  }

  private consumeMomentum(): boolean {
    if (this.momentumChargesValue <= 0) {
      return false;
    }
    this.momentumChargesValue--;
    this.hitCountValue = 0;
    this.comboRemaining = 0;
    return true;
  }

  private beginAction(
    action: WeaponAction,
    duration: number,
    directionX: number,
    directionZ: number,
    allocateSequence = true,
  ): void {
    this.actionValue = action;
    this.elapsed = 0;
    this.duration = duration;
    this.directionXValue = directionX;
    this.directionZValue = directionZ;
    this.impactEmitted = false;
    if (allocateSequence) {
      this.attackSequenceValue = nextSequence(this.attackSequenceValue);
    }
  }

  private finishAction(): void {
    this.actionValue = WeaponAction.Idle;
    this.elapsed = 0;
    this.duration = 1;
    this.impactEmitted = false;
  }
}

function resetEvents(events: MutableHammerActionEvents): void {
  events.swingImpact = false;
  events.uppercutImpact = false;
  events.spinPulse = false;
  events.spinFinal = false;
}

function nextSequence(current: number): number {
  return current >= 0xffffffff ? 1 : current + 1;
}
