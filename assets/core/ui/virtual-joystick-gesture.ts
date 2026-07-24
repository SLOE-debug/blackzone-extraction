/** 虚拟摇杆单次触摸结束后产生的结果。 */
export enum VirtualJoystickGestureEndResult {
  Ignored,
  Released,
  ActionPressed,
}

/** 虚拟摇杆一次触摸期间严格互斥的输入职责。 */
export enum VirtualJoystickMode {
  Axis,
  Action,
}

/**
 * 管理虚拟摇杆的单指所有权与互斥输入模式。
 *
 * 该状态机不依赖 Cocos 事件对象，使轴输入、操作点击、取消和多点触控语义可以隔离验证。
 */
export class VirtualJoystickGesture {
  private touchId: number | null = null;
  private touchMode: VirtualJoystickMode | null = null;
  private actionPressPending = false;

  /** 当前是否已有一根手指拥有摇杆。 */
  public get active(): boolean {
    return this.touchId !== null;
  }

  /** 当前触摸是否允许摇杆写入轴值。 */
  public get axisInputEnabled(): boolean {
    return this.touchId !== null && this.touchMode === VirtualJoystickMode.Axis;
  }

  /** 返回当前触摸锁定的输入模式，未触摸时返回空。 */
  public get mode(): VirtualJoystickMode | null {
    return this.touchId === null ? null : this.touchMode;
  }

  /** 判断指定手指是否拥有当前摇杆。 */
  public owns(touchId: number): boolean {
    return this.matches(touchId);
  }

  /** 尝试让一根手指取得摇杆所有权。 */
  public begin(touchId: number, mode: VirtualJoystickMode): boolean {
    if (!Number.isSafeInteger(touchId) || this.touchId !== null) {
      return false;
    }
    this.touchId = touchId;
    this.touchMode = mode;
    return true;
  }

  /** 保持当前触摸所有权，移动不会改变本次触摸锁定的模式。 */
  public move(touchId: number): boolean {
    return this.matches(touchId);
  }

  /** 在有效手指松开时决定是否生成一次场景操作。 */
  public end(touchId: number): VirtualJoystickGestureEndResult {
    if (!this.matches(touchId)) {
      return VirtualJoystickGestureEndResult.Ignored;
    }
    const actionPressed = this.touchMode === VirtualJoystickMode.Action;
    this.touchId = null;
    this.touchMode = null;
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
    this.touchMode = null;
    return true;
  }

  /** 读取并清除最近一次 Action 模式松开产生的场景操作。 */
  public consumeActionPress(): boolean {
    const pressed = this.actionPressPending;
    this.actionPressPending = false;
    return pressed;
  }

  /** 隐藏或销毁摇杆时释放全部手势状态。 */
  public reset(): void {
    this.touchId = null;
    this.touchMode = null;
    this.actionPressPending = false;
  }

  private matches(touchId: number): boolean {
    return this.touchId !== null && touchId === this.touchId;
  }
}
