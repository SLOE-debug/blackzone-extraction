/** 技能按键一次手势最终产生的互斥结果。 */
export enum ExclusiveActionGestureResult {
  None,
  ShortPress,
  LongHold,
}

/** 独立管理技能键触摸所有权、长按阈值和唯一动作快照。 */
export class ExclusiveActionGesture {
  private touchId: number | null = null;
  private keyboardActive = false;
  private elapsed = 0;
  private longTriggered = false;
  private pending = ExclusiveActionGestureResult.None;

  constructor(private readonly holdThresholdSeconds: number) {
    if (!Number.isFinite(holdThresholdSeconds) || holdThresholdSeconds <= 0) {
      throw new Error('独占动作长按阈值必须为有限正数。');
    }
  }

  public get active(): boolean {
    return this.touchId !== null || this.keyboardActive;
  }

  public get holdProgress(): number {
    return Math.max(0, Math.min(1, this.elapsed / this.holdThresholdSeconds));
  }

  public ownsTouch(touchId: number): boolean {
    return this.touchId === touchId;
  }

  public beginTouch(touchId: number): boolean {
    if (!Number.isSafeInteger(touchId)
      || this.active
      || this.pending !== ExclusiveActionGestureResult.None) {
      return false;
    }
    this.touchId = touchId;
    this.begin();
    return true;
  }

  /** 正常松开在未达到长按阈值时生成一次短按。 */
  public endTouch(touchId: number): boolean {
    if (!this.ownsTouch(touchId)) {
      return false;
    }
    this.touchId = null;
    this.end();
    return true;
  }

  /** Cocos 取消只释放触摸所有权，不误触发任何技能。 */
  public cancelTouch(touchId: number): boolean {
    if (!this.ownsTouch(touchId)) {
      return false;
    }
    this.touchId = null;
    this.resetHold();
    return true;
  }

  public setKeyboardActive(active: boolean): boolean {
    if (this.keyboardActive === active || (active && this.touchId !== null)) {
      return false;
    }
    this.keyboardActive = active;
    if (active) {
      this.begin();
    } else {
      this.end();
    }
    return true;
  }

  /** 长按达到阈值的当帧立即生成事件，不等待手指松开。 */
  public update(deltaTime: number): void {
    if (!this.active || this.longTriggered) {
      return;
    }
    this.elapsed += Math.max(0, deltaTime);
    if (this.elapsed >= this.holdThresholdSeconds) {
      this.longTriggered = true;
      this.pending = ExclusiveActionGestureResult.LongHold;
    }
  }

  public consume(): ExclusiveActionGestureResult {
    const result = this.pending;
    this.pending = ExclusiveActionGestureResult.None;
    return result;
  }

  public reset(): void {
    this.touchId = null;
    this.keyboardActive = false;
    this.pending = ExclusiveActionGestureResult.None;
    this.resetHold();
  }

  private begin(): void {
    this.elapsed = 0;
    this.longTriggered = false;
  }

  private end(): void {
    if (!this.longTriggered && this.pending === ExclusiveActionGestureResult.None) {
      this.pending = ExclusiveActionGestureResult.ShortPress;
    }
    this.resetHold();
  }

  private resetHold(): void {
    this.elapsed = 0;
    this.longTriggered = false;
  }
}
