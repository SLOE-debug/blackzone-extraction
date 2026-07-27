import { WeaponAction, type MeleeWeaponDefinition } from '../../../../core/equipment/equipment';
import {
  BattlefieldFacingLockSource,
  type BattlefieldFacingLockEffect,
} from './battlefield-facing-lock-effect';

const SWING_WINDUP_SECONDS = 0.28;
const SWING_CONTACT_SECONDS = 0.34;
const UPPERCUT_CONTACT_TIME = 0.2;
const UPPERCUT_DURATION = 0.64;
const GROUND_SLAM_IMPACT_TIME = 0.48;
const GROUND_SLAM_DURATION = 0.82;
const HIT_STOP_SECONDS = 0.045;

/** 单次动作更新产生的无分配事件快照。 */
export interface MutableHammerActionEvents {
  uppercutImpact: boolean;
  groundSlamImpact: boolean;
  spinPulse: boolean;
  spinFinal: boolean;
}

/** 管理左右交替挥动、五连击震势与三种特殊攻击时间轴。 */
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
  private poseSideValue: -1 | 0 | 1 = 0;
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

  /** 横扫及其恢复阶段保留的有符号动作方向。 */
  public get poseSide(): -1 | 0 | 1 {
    return this.poseSideValue;
  }

  /** 锤头处于可连续扫掠的左右横扫阶段。 */
  public get sweepActive(): boolean {
    return this.actionValue === WeaponAction.SwingLeft
      || this.actionValue === WeaponAction.SwingRight;
  }

  public get facingLock(): Readonly<BattlefieldFacingLockEffect> | null {
    const source = getFacingLockSource(this.actionValue);
    if (source === null) {
      return null;
    }
    this.facingLockEffect.source = source;
    this.facingLockEffect.lockedHeading = this.actionValue === WeaponAction.Spin
      ? this.lockedHeading + this.progress * Math.PI * 6
      : this.lockedHeading;
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
    this.poseSideValue = startLeft ? -1 : 1;
    this.lockedHeading = Math.atan2(directionX, directionZ);
    return true;
  }

  public requestUppercut(heading: number): boolean {
    if (!this.canStartAction() || !this.consumeMomentum()) {
      return false;
    }
    this.beginAction(WeaponAction.Uppercut, UPPERCUT_DURATION, Math.sin(heading), Math.cos(heading));
    this.poseSideValue = 0;
    this.lockedHeading = heading;
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
    this.poseSideValue = 0;
    this.skillSequenceValue = nextSequence(this.skillSequenceValue);
    this.nextSpinPulseTime = 0.16;
    return true;
  }

  public requestGroundSlam(heading: number): boolean {
    if (!this.canStartAction() || !this.consumeMomentum()) {
      return false;
    }
    this.beginAction(
      WeaponAction.GroundSlam,
      GROUND_SLAM_DURATION,
      Math.sin(heading),
      Math.cos(heading),
    );
    this.poseSideValue = 0;
    this.lockedHeading = heading;
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
      case WeaponAction.GroundSlam:
        if (!this.impactEmitted && this.elapsed >= GROUND_SLAM_IMPACT_TIME) {
          this.impactEmitted = true;
          result.groundSlamImpact = true;
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

  /** 卸下武器时清空动作、连击、震势和朝向锁定。 */
  public reset(): void {
    this.actionValue = WeaponAction.Idle;
    this.elapsed = 0;
    this.duration = 1;
    this.impactEmitted = false;
    this.nextSpinPulseTime = 0;
    this.directionXValue = 0;
    this.directionZValue = 1;
    this.hitCountValue = 0;
    this.momentumChargesValue = 0;
    this.comboRemaining = 0;
    this.hitStopRemaining = 0;
    this.poseSideValue = 0;
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
  events.uppercutImpact = false;
  events.groundSlamImpact = false;
  events.spinPulse = false;
  events.spinFinal = false;
}

function nextSequence(current: number): number {
  return current >= 0xffffffff ? 1 : current + 1;
}

function getFacingLockSource(action: WeaponAction): BattlefieldFacingLockSource | null {
  switch (action) {
    case WeaponAction.WindupLeft:
    case WeaponAction.SwingLeft:
    case WeaponAction.WindupRight:
    case WeaponAction.SwingRight:
    case WeaponAction.Recover:
      return BattlefieldFacingLockSource.HammerSwing;
    case WeaponAction.Uppercut:
      return BattlefieldFacingLockSource.HammerUppercut;
    case WeaponAction.GroundSlam:
      return BattlefieldFacingLockSource.HammerGroundSlam;
    case WeaponAction.Spin:
      return BattlefieldFacingLockSource.HammerSpin;
    case WeaponAction.Idle:
      return null;
  }
}
