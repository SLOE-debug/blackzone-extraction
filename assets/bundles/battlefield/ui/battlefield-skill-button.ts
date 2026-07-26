import { Color, EventTouch, Graphics, Layers, Node, UITransform } from 'cc';
import {
  ExclusiveActionGesture,
  ExclusiveActionGestureResult,
} from './exclusive-action-gesture';

const BUTTON_RADIUS = 31;
const HOLD_THRESHOLD_SECONDS = 0.35;
const READY_COLOR = new Color(242, 177, 74, 255);
const CHARGE_COLOR = new Color(112, 196, 220, 245);
const EMPTY_COLOR = new Color(74, 91, 98, 190);
const FILL_COLOR = new Color(45, 53, 55, 225);

/** 技能键向世界输入层暴露的互斥命令。 */
export enum BattlefieldSkillButtonCommand {
  None,
  Uppercut,
  Spin,
}

/** 摇杆内右上方的独立技能键，拥有自己的 touch ID 和五段震势环。 */
export class BattlefieldSkillButton {
  private readonly root: Node;
  private readonly gesture = new ExclusiveActionGesture(HOLD_THRESHOLD_SECONDS);
  private hitCount = 0;
  private requiredHits = 5;
  private ready = false;
  private centerX = 0;
  private centerY = 0;
  private revision = 1;
  private disposed = false;

  constructor(parent: Node) {
    const root = new Node('BattlefieldSkillButton');
    root.layer = Layers.Enum.UI_2D;
    parent.addChild(root);
    root.addComponent(UITransform).setContentSize(BUTTON_RADIUS * 2.25, BUTTON_RADIUS * 2.25);
    root.on(Node.EventType.TOUCH_START, this.handleTouchStart, this);
    root.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    root.on(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
    this.root = root;
  }

  public get graphicsRevision(): number {
    return this.revision;
  }

  public get active(): boolean {
    return this.gesture.active;
  }

  public setPosition(x: number, y: number): void {
    if (this.centerX === x && this.centerY === y) {
      return;
    }
    this.centerX = x;
    this.centerY = y;
    this.root.setPosition(x, y);
    this.invalidate();
  }

  public presentCharge(hitCount: number, requiredHits: number, ready: boolean): void {
    if (!Number.isSafeInteger(hitCount) || hitCount < 0
      || !Number.isSafeInteger(requiredHits) || requiredHits <= 0) {
      throw new Error('技能键震势进度参数无效。');
    }
    if (this.hitCount === hitCount && this.requiredHits === requiredHits && this.ready === ready) {
      return;
    }
    this.hitCount = hitCount;
    this.requiredHits = requiredHits;
    this.ready = ready;
    this.invalidate();
  }

  public update(deltaTime: number): void {
    const previousProgress = this.gesture.holdProgress;
    this.gesture.update(deltaTime);
    if (previousProgress !== this.gesture.holdProgress) {
      this.invalidate();
    }
  }

  public consumeCommand(): BattlefieldSkillButtonCommand {
    switch (this.gesture.consume()) {
      case ExclusiveActionGestureResult.ShortPress:
        return BattlefieldSkillButtonCommand.Uppercut;
      case ExclusiveActionGestureResult.LongHold:
        return BattlefieldSkillButtonCommand.Spin;
      case ExclusiveActionGestureResult.None:
        return BattlefieldSkillButtonCommand.None;
    }
  }

  public setKeyboardActive(active: boolean): void {
    if (this.gesture.setKeyboardActive(active)) {
      this.invalidate();
    }
  }

  public draw(graphics: Graphics): void {
    graphics.fillColor = FILL_COLOR;
    graphics.strokeColor = this.ready ? READY_COLOR : EMPTY_COLOR;
    graphics.lineWidth = 3;
    graphics.circle(this.centerX, this.centerY, BUTTON_RADIUS);
    graphics.fill();
    graphics.stroke();
    drawHammerIcon(graphics, this.centerX, this.centerY, this.ready ? READY_COLOR : CHARGE_COLOR);
    const segmentCount = Math.max(1, this.requiredHits);
    for (let segment = 0; segment < segmentCount; segment++) {
      const start = -Math.PI * 0.5 + segment / segmentCount * Math.PI * 2 + 0.05;
      const end = -Math.PI * 0.5 + (segment + 1) / segmentCount * Math.PI * 2 - 0.05;
      graphics.strokeColor = this.ready || segment < this.hitCount ? READY_COLOR : EMPTY_COLOR;
      graphics.lineWidth = 4;
      graphics.arc(this.centerX, this.centerY, BUTTON_RADIUS + 7, start, end, false);
      graphics.stroke();
    }
    if (this.gesture.active && this.gesture.holdProgress > 0) {
      graphics.strokeColor = READY_COLOR;
      graphics.lineWidth = 3;
      graphics.arc(
        this.centerX,
        this.centerY,
        BUTTON_RADIUS - 5,
        -Math.PI * 0.5,
        -Math.PI * 0.5 + this.gesture.holdProgress * Math.PI * 2,
        false,
      );
      graphics.stroke();
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.gesture.reset();
    if (this.root.isValid) {
      this.root.off(Node.EventType.TOUCH_START, this.handleTouchStart, this);
      this.root.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
      this.root.off(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
      this.root.destroy();
    }
  }

  private readonly handleTouchStart = (event: EventTouch): void => {
    const id = event.getID();
    if (id !== null && this.gesture.beginTouch(id)) {
      this.invalidate();
    }
    event.propagationStopped = true;
  };

  private readonly handleTouchEnd = (event: EventTouch): void => {
    const id = event.getID();
    if (id !== null && this.gesture.endTouch(id)) {
      this.invalidate();
    }
    event.propagationStopped = true;
  };

  private readonly handleTouchCancel = (event: EventTouch): void => {
    const id = event.getID();
    if (id !== null && this.gesture.cancelTouch(id)) {
      this.invalidate();
    }
    event.propagationStopped = true;
  };

  private invalidate(): void {
    this.revision = this.revision >= Number.MAX_SAFE_INTEGER ? 1 : this.revision + 1;
  }
}

function drawHammerIcon(graphics: Graphics, x: number, y: number, color: Readonly<Color>): void {
  graphics.strokeColor = color;
  graphics.fillColor = color;
  graphics.lineWidth = 4;
  graphics.moveTo(x - 8, y - 13);
  graphics.lineTo(x + 7, y + 11);
  graphics.stroke();
  graphics.moveTo(x - 15, y + 9);
  graphics.lineTo(x - 6, y + 16);
  graphics.lineTo(x + 13, y + 4);
  graphics.lineTo(x + 7, y - 3);
  graphics.close();
  graphics.fill();
}
