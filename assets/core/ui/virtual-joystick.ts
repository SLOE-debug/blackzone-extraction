import {
  EventTouch,
  Graphics,
  Layers,
  Node,
  UITransform,
  Vec2,
  Vec3,
} from 'cc';
import {
  drawVirtualJoystick,
  VirtualJoystickActionIcon,
  type VirtualJoystickPalette,
} from './virtual-joystick-graphics';
import {
  VirtualJoystickGesture,
  VirtualJoystickMode,
} from './virtual-joystick-gesture';

/** 虚拟摇杆固定尺寸、响应曲线和视觉参数。 */
export interface VirtualJoystickOptions {
  readonly radius: number;
  readonly handleRadius: number;
  readonly interactionRadius: number;
  readonly deadZone: number;
  readonly responseExponent: number;
  readonly palette: Readonly<VirtualJoystickPalette>;
}

/** 由调用方持续读取且不会逐帧替换的摇杆值。 */
export interface VirtualJoystickValue {
  x: number;
  y: number;
  magnitude: number;
}

/** 支持多点触控的固定式双轴虚拟摇杆。 */
export class VirtualJoystick {
  public readonly value: VirtualJoystickValue = { x: 0, y: 0, magnitude: 0 };
  private readonly root: Node;
  private readonly transform: UITransform;
  private readonly touchLocation = new Vec2();
  private readonly touchWorldPosition = new Vec3();
  private readonly touchLocalPosition = new Vec3();
  private readonly gesture = new VirtualJoystickGesture();
  private handleX = 0;
  private handleY = 0;
  private actionIcon: VirtualJoystickActionIcon | null = null;
  private centerX = 0;
  private centerY = 0;
  private revision = 1;
  private disposed = false;

  constructor(
    parent: Node,
    name: string,
    private readonly options: Readonly<VirtualJoystickOptions>,
  ) {
    validateOptions(options);
    const root = new Node(name);
    root.layer = Layers.Enum.UI_2D;
    parent.addChild(root);
    this.root = root;
    this.transform = root.addComponent(UITransform);
    this.transform.setContentSize(options.interactionRadius * 2, options.interactionRadius * 2);
    root.on(Node.EventType.TOUCH_START, this.handleTouchStart, this);
    root.on(Node.EventType.TOUCH_MOVE, this.handleTouchMove, this);
    root.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    root.on(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
  }

  /** 当前是否有一根手指正在控制此摇杆。 */
  public get active(): boolean {
    return this.gesture.active;
  }

  /** 共享 HUD Graphics 判断是否需要重绘使用的单调版本。 */
  public get graphicsRevision(): number {
    return this.revision;
  }

  /** 把当前摇杆外观写入调用方持有的共享 Graphics。 */
  public draw(graphics: Graphics): void {
    if (!this.root.active) {
      return;
    }
    drawVirtualJoystick(
      graphics,
      this.centerX,
      this.centerY,
      this.options.radius,
      this.options.handleRadius,
      this.handleX,
      this.handleY,
      this.options.palette,
      this.active,
      this.actionIcon,
    );
  }

  /** 更新摇杆在 Canvas 中的固定中心。 */
  public setPosition(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error('虚拟摇杆位置必须是有限数值。');
    }
    if (this.root.position.x !== x || this.root.position.y !== y) {
      this.root.setPosition(x, y, 0);
      this.centerX = x;
      this.centerY = y;
      this.invalidateGraphics();
    }
  }

  /** 设置场景操作图案并在 Axis 与 Action 职责之间严格切换。 */
  public setActionIcon(icon: VirtualJoystickActionIcon | null): void {
    if (this.disposed || this.actionIcon === icon) {
      return;
    }
    this.actionIcon = icon;
    // 模式变化时释放旧触摸，禁止同一手势跨模式继续写入轴值或触发操作。
    this.gesture.reset();
    this.resetValue();
    this.invalidateGraphics();
  }

  /** 同步隐藏命中节点和共享外观，隐藏时同时释放残留触摸。 */
  public setVisible(visible: boolean): void {
    if (this.disposed || this.root.active === visible) {
      return;
    }
    this.root.active = visible;
    this.gesture.reset();
    this.resetValue();
    this.invalidateGraphics();
  }

  /** 读取并清除最近一次 Action 模式松开产生的场景操作。 */
  public consumeActionPress(): boolean {
    return this.gesture.consumeActionPress();
  }

  /** 解除触摸监听并销毁摇杆节点。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.gesture.reset();
    this.resetValue();
    if (!this.root.isValid) {
      return;
    }
    this.root.off(Node.EventType.TOUCH_START, this.handleTouchStart, this);
    this.root.off(Node.EventType.TOUCH_MOVE, this.handleTouchMove, this);
    this.root.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    this.root.off(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
    if (this.root.isValid) {
      this.root.destroy();
    }
  }

  private handleTouchStart(event: EventTouch): void {
    const touchId = event.getID();
    if (touchId === null) {
      return;
    }
    const mode = this.actionIcon === null
      ? VirtualJoystickMode.Axis
      : VirtualJoystickMode.Action;
    if (!this.gesture.begin(touchId, mode)) {
      event.propagationStopped = true;
      return;
    }
    if (this.gesture.axisInputEnabled) {
      this.updateFromTouch(event);
    } else {
      this.resetValue();
      this.invalidateGraphics();
    }
    event.propagationStopped = true;
  }

  private handleTouchMove(event: EventTouch): void {
    const touchId = event.getID();
    if (touchId === null || !this.gesture.owns(touchId)) {
      return;
    }
    if (this.gesture.axisInputEnabled) {
      this.updateFromTouch(event);
    }
    this.gesture.move(touchId);
    event.propagationStopped = true;
  }

  private handleTouchEnd(event: EventTouch): void {
    const touchId = event.getID();
    if (touchId !== null && this.gesture.owns(touchId)) {
      if (this.gesture.axisInputEnabled) {
        this.updateFromTouch(event);
      }
      this.gesture.end(touchId);
      this.releaseTouch(event);
    }
  }

  private handleTouchCancel(event: EventTouch): void {
    const touchId = event.getID();
    if (touchId !== null && this.gesture.cancel(touchId)) {
      this.releaseTouch(event);
    }
  }

  /** 将屏幕 UI 坐标转换为摇杆局部坐标并应用死区响应。 */
  private updateFromTouch(event: EventTouch): void {
    event.getUILocation(this.touchLocation);
    this.touchWorldPosition.set(this.touchLocation.x, this.touchLocation.y, 0);
    this.transform.convertToNodeSpaceAR(this.touchWorldPosition, this.touchLocalPosition);
    const rawLength = Math.hypot(this.touchLocalPosition.x, this.touchLocalPosition.y);
    const clampedLength = Math.min(rawLength, this.options.radius);
    const inverseRawLength = rawLength > 0.000001 ? 1 / rawLength : 0;
    const directionX = this.touchLocalPosition.x * inverseRawLength;
    const directionY = this.touchLocalPosition.y * inverseRawLength;
    this.handleX = directionX * clampedLength;
    this.handleY = directionY * clampedLength;

    const normalizedLength = clampedLength / this.options.radius;
    const deadZone = this.options.deadZone;
    const remappedLength = normalizedLength <= deadZone
      ? 0
      : Math.pow(
        (normalizedLength - deadZone) / (1 - deadZone),
        this.options.responseExponent,
      );
    this.value.x = directionX * remappedLength;
    this.value.y = directionY * remappedLength;
    this.value.magnitude = remappedLength;
    this.invalidateGraphics();
  }

  private releaseTouch(event: EventTouch): void {
    this.resetValue();
    this.invalidateGraphics();
    event.propagationStopped = true;
  }

  private resetValue(): void {
    this.value.x = 0;
    this.value.y = 0;
    this.value.magnitude = 0;
    this.handleX = 0;
    this.handleY = 0;
  }

  /** 标记共享图形批次需要在下一同步点整体重绘。 */
  private invalidateGraphics(): void {
    this.revision = this.revision >= Number.MAX_SAFE_INTEGER ? 1 : this.revision + 1;
  }
}

/** 拒绝会产生不可用死区或越界摇杆帽的配置。 */
function validateOptions(options: Readonly<VirtualJoystickOptions>): void {
  const values = [
    options.radius,
    options.handleRadius,
    options.interactionRadius,
    options.deadZone,
    options.responseExponent,
  ];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error('虚拟摇杆参数必须是有限数值。');
  }
  if (options.radius <= 0
    || options.handleRadius <= 0
    || options.handleRadius >= options.radius
    || options.interactionRadius < options.radius
    || options.deadZone < 0
    || options.deadZone >= 1
    || options.responseExponent <= 0) {
    throw new Error('虚拟摇杆尺寸或响应参数无效。');
  }
}
