import { type Color, EventTouch, Graphics, Layers, Node, UITransform } from 'cc';
import {
  drawVirtualJoystickActionIcon,
  VirtualJoystickActionIcon,
  type VirtualJoystickPalette,
} from '../../../core/ui/virtual-joystick-graphics';

/** 普通攻击按钮的固定尺寸与共享图形配色。 */
export interface BattlefieldAttackButtonOptions {
  readonly radius: number;
  readonly interactionRadius: number;
  readonly palette: Readonly<VirtualJoystickPalette>;
}

/** 普攻按钮按当前武器切换的矢量图案。 */
export enum BattlefieldPrimaryAttackIcon {
  Hammer,
  Bow,
}

/** 只产生攻击按下边沿和持续按住状态的单轴动作按钮。 */
export class BattlefieldAttackButton {
  private readonly root: Node;
  private activeTouchId: number | null = null;
  private contextAction: VirtualJoystickActionIcon | null = null;
  private primaryIcon = BattlefieldPrimaryAttackIcon.Hammer;
  private attackPressed = false;
  private actionPressed = false;
  private heldValue = false;
  private centerX = 0;
  private centerY = 0;
  private revision = 1;
  private disposed = false;

  constructor(
    parent: Node,
    private readonly options: Readonly<BattlefieldAttackButtonOptions>,
  ) {
    validateOptions(options);
    const root = new Node('BattlefieldAttackButton');
    root.layer = Layers.Enum.UI_2D;
    parent.addChild(root);
    root.addComponent(UITransform).setContentSize(
      options.interactionRadius * 2,
      options.interactionRadius * 2,
    );
    root.on(Node.EventType.TOUCH_START, this.handleTouchStart, this);
    root.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    root.on(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
    this.root = root;
  }

  public get held(): boolean {
    return this.heldValue;
  }

  public get graphicsRevision(): number {
    return this.revision;
  }

  /** 更新按钮中心，不赋予触点任何方向含义。 */
  public setPosition(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error('普通攻击按钮位置必须是有限数值。');
    }
    if (this.centerX === x && this.centerY === y) {
      return;
    }
    this.centerX = x;
    this.centerY = y;
    this.root.setPosition(x, y);
    this.invalidate();
  }

  /** 在普通攻击与场景交互职责之间切换，并立即终止旧触点。 */
  public setContextAction(icon: VirtualJoystickActionIcon | null): void {
    if (this.disposed || this.contextAction === icon) {
      return;
    }
    this.contextAction = icon;
    this.resetTouch();
    this.attackPressed = false;
    this.actionPressed = false;
    this.invalidate();
  }

  public setPrimaryIcon(icon: BattlefieldPrimaryAttackIcon): void {
    if (this.primaryIcon !== icon) {
      this.primaryIcon = icon;
      this.invalidate();
    }
  }

  /** 切换普通攻击按钮命中与外观；隐藏时立即释放残留触点。 */
  public setVisible(visible: boolean): void {
    if (this.disposed || this.root.active === visible) {
      return;
    }
    this.root.active = visible;
    this.resetTouch();
    this.invalidate();
  }

  public consumeAttackPress(): boolean {
    const pressed = this.attackPressed;
    this.attackPressed = false;
    return pressed;
  }

  public consumeActionPress(): boolean {
    const pressed = this.actionPressed;
    this.actionPressed = false;
    return pressed;
  }

  /** 把固定圆形按钮与矢量动作图案写入 HUD 共享 Graphics。 */
  public draw(graphics: Graphics): void {
    const palette = this.options.palette;
    const radius = this.options.radius;
    graphics.fillColor = palette.base;
    graphics.circle(this.centerX, this.centerY, radius);
    graphics.fill();
    graphics.strokeColor = this.heldValue ? palette.accent : palette.rim;
    graphics.lineWidth = this.heldValue ? 5 : 4;
    graphics.circle(this.centerX, this.centerY, radius - 2);
    graphics.stroke();
    graphics.fillColor = palette.handle;
    graphics.circle(this.centerX, this.centerY, radius * 0.58);
    graphics.fill();
    const icon = this.contextAction;
    if (icon === null) {
      if (this.primaryIcon === BattlefieldPrimaryAttackIcon.Bow) {
        drawBowAttackIcon(
          graphics,
          this.centerX,
          this.centerY,
          this.heldValue ? palette.accent : palette.rim,
        );
      } else {
        drawHammerAttackIcon(
          graphics,
          this.centerX,
          this.centerY,
          this.heldValue ? palette.accent : palette.rim,
        );
      }
    } else {
      drawVirtualJoystickActionIcon(
        graphics,
        icon,
        this.centerX,
        this.centerY,
        palette.accent,
      );
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.resetTouch();
    if (!this.root.isValid) {
      return;
    }
    this.root.off(Node.EventType.TOUCH_START, this.handleTouchStart, this);
    this.root.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    this.root.off(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
    this.root.destroy();
  }

  private readonly handleTouchStart = (event: EventTouch): void => {
    const id = event.getID();
    if (id !== null && this.activeTouchId === null) {
      this.activeTouchId = id;
      if (this.contextAction === null) {
        this.heldValue = true;
        this.attackPressed = true;
      }
      this.invalidate();
    }
    event.propagationStopped = true;
  };

  private readonly handleTouchEnd = (event: EventTouch): void => {
    const id = event.getID();
    if (id !== null && id === this.activeTouchId) {
      if (this.contextAction !== null) {
        this.actionPressed = true;
      }
      this.resetTouch();
      this.invalidate();
    }
    event.propagationStopped = true;
  };

  private readonly handleTouchCancel = (event: EventTouch): void => {
    const id = event.getID();
    if (id !== null && id === this.activeTouchId) {
      this.resetTouch();
      this.invalidate();
    }
    event.propagationStopped = true;
  };

  private resetTouch(): void {
    this.activeTouchId = null;
    this.heldValue = false;
  }

  private invalidate(): void {
    this.revision = this.revision >= Number.MAX_SAFE_INTEGER ? 1 : this.revision + 1;
  }
}

function drawBowAttackIcon(
  graphics: Graphics,
  centerX: number,
  centerY: number,
  color: Readonly<Color>,
): void {
  graphics.strokeColor = color;
  graphics.fillColor = color;
  graphics.lineWidth = 4;
  graphics.moveTo(centerX - 13, centerY - 17);
  graphics.bezierCurveTo(centerX + 10, centerY - 10, centerX + 10, centerY + 10, centerX - 13, centerY + 17);
  graphics.stroke();
  graphics.moveTo(centerX - 13, centerY - 17);
  graphics.lineTo(centerX - 3, centerY);
  graphics.lineTo(centerX - 13, centerY + 17);
  graphics.stroke();
  graphics.moveTo(centerX - 8, centerY);
  graphics.lineTo(centerX + 17, centerY);
  graphics.stroke();
  graphics.moveTo(centerX + 17, centerY);
  graphics.lineTo(centerX + 9, centerY + 5);
  graphics.lineTo(centerX + 9, centerY - 5);
  graphics.close();
  graphics.fill();
}

/** 用倾斜锤柄和分面锤头表达无方向普通攻击。 */
function drawHammerAttackIcon(
  graphics: Graphics,
  centerX: number,
  centerY: number,
  color: Readonly<Color>,
): void {
  graphics.strokeColor = color;
  graphics.fillColor = color;
  graphics.lineWidth = 5;
  graphics.moveTo(centerX - 11, centerY - 15);
  graphics.lineTo(centerX + 8, centerY + 9);
  graphics.stroke();
  graphics.moveTo(centerX - 2, centerY + 8);
  graphics.lineTo(centerX + 10, centerY + 17);
  graphics.lineTo(centerX + 19, centerY + 8);
  graphics.lineTo(centerX + 7, centerY - 1);
  graphics.close();
  graphics.fill();
}

function validateOptions(options: Readonly<BattlefieldAttackButtonOptions>): void {
  if (!Number.isFinite(options.radius)
    || !Number.isFinite(options.interactionRadius)
    || options.radius <= 0
    || options.interactionRadius < options.radius) {
    throw new Error('普通攻击按钮尺寸必须使用合法有限值。');
  }
}
