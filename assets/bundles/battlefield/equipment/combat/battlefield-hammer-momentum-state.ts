import { type MeleeWeaponDefinition } from '../../../../core/equipment/equipment';

const HIT_STOP_SECONDS = 0.045;

/** 独立管理有效攻击序列产生的震势进度与命中停顿。 */
export class BattlefieldHammerMomentumState {
  private hitCountValue = 0;
  private chargesValue = 0;
  private comboRemaining = 0;
  private hitStopRemaining = 0;
  private lastConfirmedSwingSequence = 0;

  public get hitCount(): number {
    return this.hitCountValue;
  }

  public get charges(): number {
    return this.chargesValue;
  }

  public get hitStopped(): boolean {
    return this.hitStopRemaining > 0;
  }

  /** 推进命中连击超时，并返回扣除命中停顿后的可用动作时间。 */
  public consumeFrameTime(deltaTime: number): number {
    this.comboRemaining = Math.max(0, this.comboRemaining - deltaTime);
    if (this.comboRemaining <= 0 && this.hitCountValue > 0) {
      this.hitCountValue = 0;
    }
    const stoppedTime = Math.min(deltaTime, this.hitStopRemaining);
    this.hitStopRemaining -= stoppedTime;
    return deltaTime - stoppedTime;
  }

  /** 同一普通攻击序列无论命中多少怪物都只累计一次有效命中。 */
  public recordConfirmedSwing(
    attackSequenceId: number,
    definition: Readonly<MeleeWeaponDefinition>,
  ): void {
    if (attackSequenceId > 0 && this.lastConfirmedSwingSequence === attackSequenceId) {
      return;
    }
    if (attackSequenceId > 0) {
      this.lastConfirmedSwingSequence = attackSequenceId;
    }
    this.hitCountValue++;
    this.comboRemaining = definition.comboWindowSeconds;
    this.hitStopRemaining = HIT_STOP_SECONDS;
    if (this.hitCountValue >= definition.specialRequiredHits) {
      this.hitCountValue = 0;
      this.chargesValue = 1;
    }
  }

  /** 消耗一层共享震势；资源不足时不改变任何状态。 */
  public consumeCharge(): boolean {
    if (this.chargesValue <= 0) {
      return false;
    }
    this.chargesValue--;
    this.hitCountValue = 0;
    this.comboRemaining = 0;
    return true;
  }

  public reset(): void {
    this.hitCountValue = 0;
    this.chargesValue = 0;
    this.comboRemaining = 0;
    this.hitStopRemaining = 0;
    this.lastConfirmedSwingSequence = 0;
  }
}
