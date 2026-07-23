/** 虚拟摇杆单次触摸结束后产生的结果。 */
export enum VirtualJoystickGestureEndResult {
  Ignored,
  Released,
  ActionPressed,
}

/**
 * 管理虚拟摇杆的单指所有权与场景操作点击候选。
 *
 * 该状态机不依赖 Cocos 事件对象，使点击、拖动、取消和多点触控语义可以隔离验证。
 */
export class VirtualJoystickGesture {
  private touchId: number | null = null;
  private actionCandidate = false;
  private actionPressPending = false;

  /** 当前是否已有一根手指拥有摇杆。 */
  public get active(): boolean {
    return this.touchId !== null;
  }

  /** 判断指定手指是否拥有当前摇杆。 */
  public owns(touchId: number): boolean {
    return this.matches(touchId);
  }

  /** 尝试让一根手指取得摇杆所有权。 */
  public begin(touchId: number, actionAvailable: boolean): boolean {
    if (!Number.isSafeInteger(touchId) || this.touchId !== null) {
      return false;
    }
    this.touchId = touchId;
    this.actionCandidate = actionAvailable;
    return true;
  }

  /**
   * 同步当前触摸是否仍在死区内。
   *
   * 一旦离开死区，本次手势永久转为摇杆拖动，之后回到中心也不会触发操作。
   */
  public move(touchId: number, insideDeadZone: boolean): boolean {
    if (!this.matches(touchId)) {
      return false;
    }
    if (!insideDeadZone) {
      this.actionCandidate = false;
    }
    return true;
  }

  /** 在有效手指松开时决定是否生成一次场景操作。 */
  public end(touchId: number, insideDeadZone: boolean): VirtualJoystickGestureEndResult {
    if (!this.matches(touchId)) {
      return VirtualJoystickGestureEndResult.Ignored;
    }
    const actionPressed = this.actionCandidate && insideDeadZone;
    this.touchId = null;
    this.actionCandidate = false;
    if (actionPressed) {
      this.actionPressPending = true;
      return VirtualJoystickGestureEndResult.ActionPressed;
    }
    return VirtualJoystickGestureEndResult.Released;
  }

  /** 取消有效触摸，但绝不把取消事件解释成点击。 */
  public cancel(touchId: number): boolean {
    if (!this.matches(touchId)) {
      return false;
    }
    this.touchId = null;
    this.actionCandidate = false;
    return true;
  }

  /** 场景操作变化时只取消点击候选，保留正在进行的摇杆拖动。 */
  public cancelActionCandidate(): void {
    this.actionCandidate = false;
    this.actionPressPending = false;
  }

  /** 读取并清除最近一次在死区内完成的场景操作。 */
  public consumeActionPress(): boolean {
    const pressed = this.actionPressPending;
    this.actionPressPending = false;
    return pressed;
  }

  /** 隐藏或销毁摇杆时释放全部手势状态。 */
  public reset(): void {
    this.touchId = null;
    this.actionCandidate = false;
    this.actionPressPending = false;
  }

  private matches(touchId: number): boolean {
    return this.touchId !== null && touchId === this.touchId;
  }
}
