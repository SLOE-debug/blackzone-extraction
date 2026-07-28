/** 归弦猎弓内部动作阶段，不扩张角色公共动作枚举。 */
export enum BattlefieldBowAction {
  Idle,
  Charging,
  Recover,
  AutoRecalling,
  SkillRecalling,
  TetherCast,
}

/** 管理按住、松开、蓄力和射击恢复的轻量动作状态。 */
export class BattlefieldBowActionState {
  private actionValue = BattlefieldBowAction.Idle;
  private elapsedSeconds = 0;
  private attackHeld = false;
  private releasePending = false;

  public get action(): BattlefieldBowAction {
    return this.actionValue;
  }

  public get chargeSeconds(): number {
    return this.actionValue === BattlefieldBowAction.Charging ? this.elapsedSeconds : 0;
  }

  public get held(): boolean {
    return this.attackHeld;
  }

  public get elapsed(): number {
    return this.elapsedSeconds;
  }

  /** 输入层逐帧同步按住状态；松开边沿只记录一次。 */
  public setAttackHeld(held: boolean): void {
    if (this.attackHeld && !held && this.actionValue === BattlefieldBowAction.Charging) {
      this.releasePending = true;
    }
    this.attackHeld = held;
  }

  public beginCharging(): boolean {
    if (this.actionValue !== BattlefieldBowAction.Idle) {
      return false;
    }
    this.actionValue = BattlefieldBowAction.Charging;
    this.elapsedSeconds = 0;
    this.releasePending = false;
    return true;
  }

  public update(deltaTime: number, chargeDuration: number, recoveryDuration: number): boolean {
    const safeDelta = Math.max(0, Math.min(deltaTime, 0.05));
    if (this.actionValue === BattlefieldBowAction.Charging) {
      this.elapsedSeconds = Math.min(chargeDuration, this.elapsedSeconds + safeDelta);
      if (this.releasePending) {
        this.releasePending = false;
        return true;
      }
    } else if (this.actionValue === BattlefieldBowAction.Recover) {
      this.elapsedSeconds += safeDelta;
      if (this.elapsedSeconds >= recoveryDuration) {
        this.actionValue = BattlefieldBowAction.Idle;
        this.elapsedSeconds = 0;
      }
    }
    return false;
  }

  public finishShot(): void {
    this.actionValue = BattlefieldBowAction.Recover;
    this.elapsedSeconds = 0;
    this.releasePending = false;
  }

  public setAction(action: BattlefieldBowAction): void {
    this.actionValue = action;
    this.elapsedSeconds = 0;
    this.releasePending = false;
  }

  public reset(): void {
    this.actionValue = BattlefieldBowAction.Idle;
    this.elapsedSeconds = 0;
    this.attackHeld = false;
    this.releasePending = false;
  }
}
