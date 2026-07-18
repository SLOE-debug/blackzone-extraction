import {
  EventMouse,
  type EventTouch,
  game,
  input,
  Input,
  Node,
  Vec2,
} from 'cc';

/** 调用方复用的相机旋转像素增量。 */
export interface MutableBattlefieldCameraOrbitDelta {
  x: number;
  y: number;
}

/** 从鼠标中键、右键和摇杆之外的触摸区域收集相机旋转拖拽。 */
export class BattlefieldCameraOrbitInput {
  private readonly canvas = game.canvas;
  private readonly touchLocation = new Vec2();
  private readonly previousTouchLocation = new Vec2();
  private activeMouseButton: number | null = null;
  private activeTouchId: number | null = null;
  private pendingDeltaX = 0;
  private pendingDeltaY = 0;
  private disposed = false;

  constructor(private readonly touchSurface: Node) {
    touchSurface.on(Node.EventType.TOUCH_START, this.handleTouchStart, this);
    touchSurface.on(Node.EventType.TOUCH_MOVE, this.handleTouchMove, this);
    touchSurface.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    touchSurface.on(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
    input.on(Input.EventType.MOUSE_DOWN, this.handleMouseDown, this);
    input.on(Input.EventType.MOUSE_MOVE, this.handleMouseMove, this);
    input.on(Input.EventType.MOUSE_UP, this.handleMouseUp, this);
    this.canvas?.addEventListener('contextmenu', this.handleContextMenu);
  }

  /** 取走本帧累计的屏幕像素增量，并清空内部缓冲。 */
  public consume(result: MutableBattlefieldCameraOrbitDelta): void {
    result.x = this.pendingDeltaX;
    result.y = this.pendingDeltaY;
    this.pendingDeltaX = 0;
    this.pendingDeltaY = 0;
  }

  /** 解除全局鼠标与触摸面板监听。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    if (this.touchSurface.isValid) {
      this.touchSurface.off(Node.EventType.TOUCH_START, this.handleTouchStart, this);
      this.touchSurface.off(Node.EventType.TOUCH_MOVE, this.handleTouchMove, this);
      this.touchSurface.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
      this.touchSurface.off(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
    }
    input.off(Input.EventType.MOUSE_DOWN, this.handleMouseDown, this);
    input.off(Input.EventType.MOUSE_MOVE, this.handleMouseMove, this);
    input.off(Input.EventType.MOUSE_UP, this.handleMouseUp, this);
    this.canvas?.removeEventListener('contextmenu', this.handleContextMenu);
    this.activeMouseButton = null;
    this.activeTouchId = null;
    this.pendingDeltaX = 0;
    this.pendingDeltaY = 0;
    this.disposed = true;
  }

  private handleMouseDown(event: EventMouse): void {
    const button = event.getButton();
    if (button === EventMouse.BUTTON_MIDDLE || button === EventMouse.BUTTON_RIGHT) {
      this.activeMouseButton = button;
    }
  }

  private handleMouseMove(event: EventMouse): void {
    if (this.activeMouseButton === null) {
      return;
    }
    this.pendingDeltaX += event.getDeltaX();
    this.pendingDeltaY += event.getDeltaY();
  }

  private handleMouseUp(event: EventMouse): void {
    if (event.getButton() === this.activeMouseButton) {
      this.activeMouseButton = null;
    }
  }

  private handleTouchStart(event: EventTouch): void {
    const touchId = event.getID();
    if (event.target !== this.touchSurface
      || touchId === null
      || this.activeTouchId !== null) {
      return;
    }
    event.getUILocation(this.previousTouchLocation);
    this.activeTouchId = touchId;
    event.propagationStopped = true;
  }

  private handleTouchMove(event: EventTouch): void {
    if (!this.matchesActiveTouch(event)) {
      return;
    }
    event.getUILocation(this.touchLocation);
    this.pendingDeltaX += this.touchLocation.x - this.previousTouchLocation.x;
    this.pendingDeltaY += this.previousTouchLocation.y - this.touchLocation.y;
    Vec2.copy(this.previousTouchLocation, this.touchLocation);
    event.propagationStopped = true;
  }

  private handleTouchEnd(event: EventTouch): void {
    if (this.matchesActiveTouch(event)) {
      this.releaseTouch(event);
    }
  }

  private handleTouchCancel(event: EventTouch): void {
    if (this.matchesActiveTouch(event)) {
      this.releaseTouch(event);
    }
  }

  private releaseTouch(event: EventTouch): void {
    this.activeTouchId = null;
    event.propagationStopped = true;
  }

  private matchesActiveTouch(event: EventTouch): boolean {
    return this.activeTouchId !== null && event.getID() === this.activeTouchId;
  }

  private readonly handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
}
