import { WeaponAction, type MeleeWeaponDefinition } from '../../../../core/equipment/equipment';
import { SLEDGEHAMMER_PROGRESSION } from '../items/sledgehammer/sledgehammer-progression';
import { calculateSledgehammerSpinAngle } from '../items/sledgehammer/sledgehammer-spin-timeline';
import { type BattlefieldHammerActionControlEffect } from './battlefield-facing-lock-effect';
import { BattlefieldHammerActionControlSnapshot } from './battlefield-hammer-action-control-snapshot';
import {
  nextHammerActionSequence,
  resetHammerActionEvents,
  type MutableHammerActionEvents,
} from './battlefield-hammer-action-events';
import { calculateRequiredWindupTurnSpeed } from './battlefield-hammer-windup-turn';
import { BattlefieldHammerMomentumState } from './battlefield-hammer-momentum-state';

const SWING_WINDUP_SECONDS = 0.28;
const SWING_CONTACT_SECONDS = 0.34;
const CHAIN_PREPARE_SECONDS = 0.12;
const SWING_BUFFER_SECONDS = 0.14;
const UPPERCUT_BUFFER_SECONDS = 0.16;
const UPPERCUT_CONTACT_TIME = 0.2;
const AUTOMATIC_UPPERCUT_DURATION = 0.64;
const GROUND_SLAM_IMPACT_TIME = 0.48;
const GROUND_SLAM_DURATION = 0.82;
const MAXIMUM_TRANSITIONS_PER_UPDATE = 4;
const TIMELINE_EPSILON = 0.000001;

/** 管理二加一普通连段、五次有效命中震势与两种主动技能时间轴。 */
export class BattlefieldHammerActionState {
  private actionValue = WeaponAction.Idle;
  private elapsed = 0;
  private duration = 1;
  private impactEmitted = false;
  private nextSpinHitAngle = SLEDGEHAMMER_PROGRESSION.spinHitWindowAngle;
  private spinAngleValue = 0;
  private spinAngleDeltaValue = 0;
  private attackSequenceValue = 0;
  private skillSequenceValue = 0;
  private alternateLeft = true;
  private lastRequestedRight: boolean | null = null;
  private directionXValue = 0;
  private directionZValue = 1;
  private completedNormalSwingCount = 0;
  private normalComboRemaining = 0;
  private lockedHeading = 0;
  private windupMaximumTurnSpeed = 0;
  private poseSideValue: -1 | 0 | 1 = 0;
  private attackHeldValue = false;
  private queuedSwing = false;
  private queuedDirectionX = 0;
  private queuedDirectionZ = 1;
  private readonly momentum = new BattlefieldHammerMomentumState();
  private readonly actionControlSnapshot = new BattlefieldHammerActionControlSnapshot();

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

  public get hitCount(): number { return this.momentum.hitCount; }

  public get momentumCharges(): number {
    return this.momentum.charges;
  }

  /** 已完成的普通横扫段数；达到二时下一段固定进入自动上挑。 */
  public get completedNormalSwings(): number {
    return this.completedNormalSwingCount;
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

  /** 旋风期间每帧都必须收集真实视觉锤头扫掠。 */
  public get spinSweepActive(): boolean {
    return this.actionValue === WeaponAction.Spin;
  }

  /** 本次更新内旋风时间轴实际推进的角度，供圆弧扫掠确定子步数。 */
  public get spinAngleDelta(): number {
    return this.spinAngleDeltaValue;
  }

  /** 当前普通攻击或技能持有的权威目标朝向。 */
  public get attackHeading(): number {
    return this.lockedHeading;
  }

  /** 空闲时需要输入层为首次挥动解析一次自动目标。 */
  public get needsInitialSwingAim(): boolean {
    return this.actionValue === WeaponAction.Idle;
  }

  /** 当前横扫已进入预输入窗口且尚未锁定下一击方向。 */
  public get canBufferNextSwing(): boolean {
    if (this.queuedSwing) {
      return false;
    }
    if (this.actionValue === WeaponAction.SwingLeft
      || this.actionValue === WeaponAction.SwingRight) {
      return this.duration - this.elapsed <= SWING_BUFFER_SECONDS
        || this.momentum.hitStopped;
    }
    if (this.actionValue === WeaponAction.Uppercut) {
      return this.duration - this.elapsed <= UPPERCUT_BUFFER_SECONDS;
    }
    return false;
  }

  public get actionControl(): Readonly<BattlefieldHammerActionControlEffect> {
    return this.actionControlSnapshot.write(
      this.actionValue,
      this.progress,
      this.windupMaximumTurnSpeed,
      this.lockedHeading,
      this.spinAngleValue,
      this.elapsed,
      this.duration,
    );
  }

  public requestSwing(
    directionX: number,
    directionZ: number,
    currentHeading: number,
    startsRight: boolean | null = null,
  ): boolean {
    if (this.canBufferNextSwing) {
      this.queuedSwing = true;
      this.queuedDirectionX = directionX;
      this.queuedDirectionZ = directionZ;
      return true;
    }
    if (!this.canStartAction()) {
      return false;
    }
    const startLeft = startsRight === null
      ? this.alternateLeft
      : this.lastRequestedRight === startsRight
        ? this.alternateLeft
        : !startsRight;
    const targetHeading = Math.atan2(directionX, directionZ);
    this.windupMaximumTurnSpeed = calculateRequiredWindupTurnSpeed(
      currentHeading,
      targetHeading,
      SWING_WINDUP_SECONDS,
    );
    this.beginAction(
      startLeft ? WeaponAction.WindupLeft : WeaponAction.WindupRight,
      SWING_WINDUP_SECONDS,
      directionX,
      directionZ,
    );
    this.alternateLeft = !startLeft;
    this.lastRequestedRight = startsRight;
    this.poseSideValue = startLeft ? -1 : 1;
    this.lockedHeading = targetHeading;
    return true;
  }

  /** 同步普通攻击持续意图；松开时取消尚未开始的下一段。 */
  public setAttackHeld(held: boolean): void {
    this.attackHeldValue = held;
    if (!held) {
      this.clearQueuedSwing();
      if (this.actionValue === WeaponAction.Idle) {
        this.resetNormalCombo();
      }
    }
  }

  public requestSpin(heading: number): boolean {
    if (!this.canStartAction() || !this.momentum.consumeCharge()) {
      return false;
    }
    this.beginAction(
      WeaponAction.Spin,
      SLEDGEHAMMER_PROGRESSION.spinDurationSeconds,
      Math.sin(heading),
      Math.cos(heading),
    );
    this.lockedHeading = heading;
    this.poseSideValue = 0;
    this.skillSequenceValue = nextHammerActionSequence(this.skillSequenceValue);
    this.spinAngleValue = 0;
    this.spinAngleDeltaValue = 0;
    this.nextSpinHitAngle = SLEDGEHAMMER_PROGRESSION.spinHitWindowAngle;
    this.resetNormalCombo();
    return true;
  }

  public requestGroundSlam(heading: number): boolean {
    if (!this.canStartAction() || !this.momentum.consumeCharge()) {
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
    this.resetNormalCombo();
    return true;
  }

  /** 推进动作并写出当前帧唯一命中或脉冲事件。 */
  public update(
    deltaTime: number,
    definition: Readonly<MeleeWeaponDefinition>,
    result: MutableHammerActionEvents,
  ): void {
    resetHammerActionEvents(result);
    this.spinAngleDeltaValue = 0;
    const frameTime = Math.max(0, deltaTime);
    this.normalComboRemaining = Math.max(0, this.normalComboRemaining - frameTime);
    if (this.normalComboRemaining <= 0 && this.completedNormalSwingCount > 0) {
      this.resetNormalCombo();
    }
    let remaining = this.momentum.consumeFrameTime(frameTime);
    let transitions = 0;
    while (remaining > TIMELINE_EPSILON
      && transitions < MAXIMUM_TRANSITIONS_PER_UPDATE
      && this.actionValue !== WeaponAction.Idle) {
      const available = Math.max(0, this.duration - this.elapsed);
      const step = Math.min(remaining, available);
      const previousElapsed = this.elapsed;
      this.elapsed += step;
      remaining -= step;
      this.emitTimelineEvents(previousElapsed, result);
      if (this.elapsed + TIMELINE_EPSILON < this.duration) {
        break;
      }
      this.elapsed = this.duration;
      this.transitionCompletedAction(definition, result);
      transitions++;
    }
  }

  /** 写出当前动作在本次时间片内跨过的接触点与旋风窗口边界。 */
  private emitTimelineEvents(
    previousElapsed: number,
    result: MutableHammerActionEvents,
  ): void {
    switch (this.actionValue) {
      case WeaponAction.Uppercut:
        if (!this.impactEmitted
          && previousElapsed < UPPERCUT_CONTACT_TIME
          && this.elapsed >= UPPERCUT_CONTACT_TIME) {
          this.impactEmitted = true;
          result.uppercutImpact = true;
        }
        break;
      case WeaponAction.GroundSlam:
        if (!this.impactEmitted
          && previousElapsed < GROUND_SLAM_IMPACT_TIME
          && this.elapsed >= GROUND_SLAM_IMPACT_TIME) {
          this.impactEmitted = true;
          result.groundSlamImpact = true;
        }
        break;
      case WeaponAction.Spin:
        {
          const previousAngle = calculateSledgehammerSpinAngle(previousElapsed);
          const currentAngle = calculateSledgehammerSpinAngle(this.elapsed);
          this.spinAngleValue = currentAngle;
          this.spinAngleDeltaValue += currentAngle - previousAngle;
        }
        while (this.spinAngleValue >= this.nextSpinHitAngle
          && this.nextSpinHitAngle
            < SLEDGEHAMMER_PROGRESSION.spinRevolutions * Math.PI * 2 - TIMELINE_EPSILON) {
          this.attackSequenceValue = nextHammerActionSequence(this.attackSequenceValue);
          result.spinPulse = true;
          this.nextSpinHitAngle += SLEDGEHAMMER_PROGRESSION.spinHitWindowAngle;
        }
        break;
      case WeaponAction.Idle:
      case WeaponAction.WindupLeft:
      case WeaponAction.SwingLeft:
      case WeaponAction.ChainPrepareLeft:
      case WeaponAction.WindupRight:
      case WeaponAction.SwingRight:
      case WeaponAction.ChainPrepareRight:
      case WeaponAction.Recover:
        break;
    }
  }

  /** 完成当前阶段，并在同一帧继续消费剩余时间。 */
  private transitionCompletedAction(
    definition: Readonly<MeleeWeaponDefinition>,
    result: MutableHammerActionEvents,
  ): void {
    switch (this.actionValue) {
      case WeaponAction.WindupLeft:
      case WeaponAction.ChainPrepareLeft:
        this.beginAction(
          WeaponAction.SwingLeft,
          SWING_CONTACT_SECONDS,
          this.directionXValue,
          this.directionZValue,
          false,
        );
        break;
      case WeaponAction.WindupRight:
      case WeaponAction.ChainPrepareRight:
        this.beginAction(
          WeaponAction.SwingRight,
          SWING_CONTACT_SECONDS,
          this.directionXValue,
          this.directionZValue,
          false,
        );
        break;
      case WeaponAction.SwingLeft:
      case WeaponAction.SwingRight:
        this.completedNormalSwingCount = Math.min(
          2,
          this.completedNormalSwingCount + 1,
        );
        this.normalComboRemaining = definition.comboWindowSeconds;
        if (this.attackHeldValue && this.queuedSwing) {
          this.beginQueuedAttack(this.actionValue === WeaponAction.SwingLeft);
        } else {
          this.clearQueuedSwing();
          this.resetNormalCombo();
          this.beginRecover(definition);
        }
        break;
      case WeaponAction.Spin:
        this.attackSequenceValue = nextHammerActionSequence(this.attackSequenceValue);
        result.spinFinal = true;
        this.finishAction();
        break;
      case WeaponAction.Uppercut:
        this.resetNormalCombo();
        if (this.attackHeldValue && this.queuedSwing) {
          const directionX = this.queuedDirectionX;
          const directionZ = this.queuedDirectionZ;
          this.clearQueuedSwing();
          this.beginAction(
            WeaponAction.ChainPrepareLeft,
            CHAIN_PREPARE_SECONDS,
            directionX,
            directionZ,
          );
          this.poseSideValue = -1;
          this.alternateLeft = false;
          this.lockedHeading = Math.atan2(directionX, directionZ);
        } else {
          this.beginRecover(definition);
        }
        break;
      case WeaponAction.GroundSlam:
      case WeaponAction.Recover:
        this.finishAction();
        break;
      case WeaponAction.Idle:
        break;
    }
  }

  /** 把缓存方向锁定为下一段横扫，或在两次横扫后转入自动上挑。 */
  private beginQueuedAttack(previousWasLeft: boolean): void {
    const directionX = this.queuedDirectionX;
    const directionZ = this.queuedDirectionZ;
    this.clearQueuedSwing();
    if (this.completedNormalSwingCount >= 2) {
      this.beginAutomaticUppercut(directionX, directionZ);
      return;
    }
    this.beginAction(
      previousWasLeft ? WeaponAction.ChainPrepareRight : WeaponAction.ChainPrepareLeft,
      CHAIN_PREPARE_SECONDS,
      directionX,
      directionZ,
    );
    this.poseSideValue = previousWasLeft ? 1 : -1;
    this.alternateLeft = previousWasLeft;
    this.lockedHeading = Math.atan2(directionX, directionZ);
  }

  /** 从普通连段内部开始不消耗震势的第三段群体上挑。 */
  private beginAutomaticUppercut(directionX: number, directionZ: number): void {
    this.beginAction(
      WeaponAction.Uppercut,
      AUTOMATIC_UPPERCUT_DURATION,
      directionX,
      directionZ,
    );
    this.lockedHeading = Math.atan2(directionX, directionZ);
    this.poseSideValue = 0;
  }

  /** 每次确认至少命中一个怪物时只增加一次连击。 */
  public recordConfirmedAttack(definition: Readonly<MeleeWeaponDefinition>): void {
    this.momentum.recordConfirmedSwing(this.attackSequenceValue, definition);
  }

  /** 卸下武器时清空动作、连击、震势和朝向锁定。 */
  public reset(): void {
    this.actionValue = WeaponAction.Idle;
    this.elapsed = 0;
    this.duration = 1;
    this.impactEmitted = false;
    this.nextSpinHitAngle = SLEDGEHAMMER_PROGRESSION.spinHitWindowAngle;
    this.spinAngleValue = 0;
    this.spinAngleDeltaValue = 0;
    this.directionXValue = 0;
    this.directionZValue = 1;
    this.momentum.reset();
    this.completedNormalSwingCount = 0;
    this.normalComboRemaining = 0;
    this.windupMaximumTurnSpeed = 0;
    this.poseSideValue = 0;
    this.attackHeldValue = false;
    this.clearQueuedSwing();
  }

  private canStartAction(): boolean {
    return this.actionValue === WeaponAction.Idle;
  }

  private clearQueuedSwing(): void {
    this.queuedSwing = false;
    this.queuedDirectionX = 0;
    this.queuedDirectionZ = 1;
  }

  /** 进入普通收势，保持当前方向但不分配新的攻击序列。 */
  private beginRecover(definition: Readonly<MeleeWeaponDefinition>): void {
    this.beginAction(
      WeaponAction.Recover,
      Math.max(0.08, definition.attackIntervalSeconds
        - SWING_WINDUP_SECONDS - SWING_CONTACT_SECONDS),
      this.directionXValue,
      this.directionZValue,
      false,
    );
  }

  /** 清除只属于二加一连段的段位与超时，不影响震势命中进度。 */
  private resetNormalCombo(): void {
    this.completedNormalSwingCount = 0;
    this.normalComboRemaining = 0;
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
      this.attackSequenceValue = nextHammerActionSequence(this.attackSequenceValue);
    }
  }

  private finishAction(): void {
    this.actionValue = WeaponAction.Idle;
    this.elapsed = 0;
    this.duration = 1;
    this.impactEmitted = false;
    this.clearQueuedSwing();
  }
}
