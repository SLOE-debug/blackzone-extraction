import {
  Color,
  EventTouch,
  Graphics,
  Label,
  Layers,
  Node,
  UITransform,
  Vec2,
  Vec3,
} from 'cc';
import {
  BattlefieldCombatModuleId,
  BattlefieldCombatModuleUnavailableReason,
} from '../action-modules/model/battlefield-combat-module';
import { BattlefieldCombatModuleRegistry } from '../action-modules/registry/battlefield-combat-module-registry';
import {
  drawBattlefieldSkillWheel,
  type BattlefieldSkillWheelDrawSlot,
} from './battlefield-skill-wheel-graphics';

const CENTER_RADIUS = 38;
const SIDE_RADIUS = 25;
const SIDE_OFFSET_X = 70;
const SIDE_OFFSET_Y = -13;
const INTERACTION_RADIUS = 54;

export interface MutableBattlefieldSkillWheelInput {
  moduleId: BattlefieldCombatModuleId;
  active: boolean;
  released: boolean;
  x: number;
  y: number;
  amplitude: number;
}

/** 管理三个可见槽位、上下文选择和按住拖动手势。 */
export class BattlefieldSkillWheel {
  private readonly registry = new BattlefieldCombatModuleRegistry();
  private readonly root: Node;
  private readonly previousNode: Node;
  private readonly actionNode: Node;
  private readonly nextNode: Node;
  private readonly reasonLabel: Label;
  private readonly touchLocation = new Vec2();
  private readonly touchWorld = new Vec3();
  private readonly touchLocal = new Vec3();
  private readonly available = [true, false, false];
  private readonly reasons = [
    BattlefieldCombatModuleUnavailableReason.None,
    BattlefieldCombatModuleUnavailableReason.NeedsCarriedTarget,
    BattlefieldCombatModuleUnavailableReason.ReservedSlot,
  ];
  private readonly slots: BattlefieldSkillWheelDrawSlot[];
  private manualIndex = 0;
  private contextualModule: BattlefieldCombatModuleId | null = null;
  private touchId: number | null = null;
  private keyboardActive = false;
  private inputX = 0;
  private inputY = 0;
  private amplitude = 0;
  private released = false;
  private releasedX = 0;
  private releasedY = 0;
  private releasedAmplitude = 0;
  private centerX = 0;
  private centerY = 0;
  private revision = 1;
  private disposed = false;

  constructor(parent: Node) {
    const root = new Node('BattlefieldSkillWheel');
    root.layer = Layers.Enum.UI_2D;
    parent.addChild(root);
    this.root = root;
    this.previousNode = createHitNode(root, 'PreviousSkill', SIDE_RADIUS * 2.2);
    this.actionNode = createHitNode(root, 'CurrentSkill', INTERACTION_RADIUS * 2);
    this.nextNode = createHitNode(root, 'NextSkill', SIDE_RADIUS * 2.2);
    this.reasonLabel = createReasonLabel(root);
    const definitions = this.registry.ordered;
    this.slots = definitions.map((definition, index) => ({
      id: definition.id,
      icon: definition.icon,
      x: 0,
      y: 0,
      radius: index === 0 ? CENTER_RADIUS : SIDE_RADIUS,
      selected: index === 0,
      available: this.available[index] ?? false,
    }));
    this.previousNode.on(Node.EventType.TOUCH_END, this.handlePrevious, this);
    this.nextNode.on(Node.EventType.TOUCH_END, this.handleNext, this);
    this.actionNode.on(Node.EventType.TOUCH_START, this.handleActionStart, this);
    this.actionNode.on(Node.EventType.TOUCH_MOVE, this.handleActionMove, this);
    this.actionNode.on(Node.EventType.TOUCH_END, this.handleActionEnd, this);
    this.actionNode.on(Node.EventType.TOUCH_CANCEL, this.handleActionCancel, this);
    this.updatePresentation();
  }

  public get selectedModule(): BattlefieldCombatModuleId {
    return this.contextualModule ?? this.registry.ordered[this.manualIndex]?.id
      ?? BattlefieldCombatModuleId.Grab;
  }

  public get graphicsRevision(): number {
    return this.revision;
  }

  public get active(): boolean {
    return this.touchId !== null || this.keyboardActive;
  }

  public setPosition(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error('技能轮盘位置必须是有限数值。');
    }
    if (this.centerX === x && this.centerY === y) {
      return;
    }
    this.centerX = x;
    this.centerY = y;
    this.previousNode.setPosition(x - SIDE_OFFSET_X, y + SIDE_OFFSET_Y);
    this.actionNode.setPosition(x, y);
    this.nextNode.setPosition(x + SIDE_OFFSET_X, y + SIDE_OFFSET_Y);
    this.reasonLabel.node.setPosition(x, y + 58);
    this.updatePresentation();
  }

  public setContextualModule(moduleId: BattlefieldCombatModuleId | null): void {
    if (this.contextualModule === moduleId) {
      return;
    }
    this.contextualModule = moduleId;
    this.cancelInput();
    this.updatePresentation();
  }

  public presentAvailability(
    moduleId: BattlefieldCombatModuleId,
    reason: BattlefieldCombatModuleUnavailableReason,
  ): void {
    const available = reason === BattlefieldCombatModuleUnavailableReason.None;
    if (this.available[moduleId] === available && this.reasons[moduleId] === reason) {
      return;
    }
    this.available[moduleId] = available;
    this.reasons[moduleId] = reason;
    this.updatePresentation();
  }

  public cycle(offset: -1 | 1): void {
    const count = this.registry.ordered.length;
    this.manualIndex = (this.manualIndex + offset + count) % count;
    this.updatePresentation();
  }

  public select(moduleId: BattlefieldCombatModuleId): void {
    const index = this.registry.ordered.findIndex((definition) => definition.id === moduleId);
    if (index < 0 || index === this.manualIndex) {
      return;
    }
    this.manualIndex = index;
    this.updatePresentation();
  }

  public setKeyboardActive(active: boolean): void {
    if (this.keyboardActive === active) {
      return;
    }
    this.keyboardActive = active;
    if (!active) {
      this.queueRelease(this.inputX, this.inputY, this.amplitude);
    }
    this.invalidate();
  }

  /** 复制本帧持续输入或唯一松开快照，读取后清除松开标记。 */
  public consumeInput(result: MutableBattlefieldSkillWheelInput): void {
    result.moduleId = this.selectedModule;
    result.active = this.active;
    result.released = this.released;
    if (this.released) {
      result.x = this.releasedX;
      result.y = this.releasedY;
      result.amplitude = this.releasedAmplitude;
      this.released = false;
    } else {
      result.x = this.inputX;
      result.y = this.inputY;
      result.amplitude = this.amplitude;
    }
  }

  public draw(graphics: Graphics): void {
    drawBattlefieldSkillWheel(graphics, this.slots, this.active);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.previousNode.off(Node.EventType.TOUCH_END, this.handlePrevious, this);
    this.nextNode.off(Node.EventType.TOUCH_END, this.handleNext, this);
    this.actionNode.off(Node.EventType.TOUCH_START, this.handleActionStart, this);
    this.actionNode.off(Node.EventType.TOUCH_MOVE, this.handleActionMove, this);
    this.actionNode.off(Node.EventType.TOUCH_END, this.handleActionEnd, this);
    this.actionNode.off(Node.EventType.TOUCH_CANCEL, this.handleActionCancel, this);
    if (this.root.isValid) {
      this.root.destroy();
    }
  }

  private readonly handlePrevious = (event: EventTouch): void => {
    this.cycle(-1);
    event.propagationStopped = true;
  };

  private readonly handleNext = (event: EventTouch): void => {
    this.cycle(1);
    event.propagationStopped = true;
  };

  private readonly handleActionStart = (event: EventTouch): void => {
    const id = event.getID();
    if (id === null || this.touchId !== null) {
      return;
    }
    this.touchId = id;
    this.updateTouch(event);
    this.invalidate();
    event.propagationStopped = true;
  };

  private readonly handleActionMove = (event: EventTouch): void => {
    if (event.getID() !== this.touchId) {
      return;
    }
    this.updateTouch(event);
    event.propagationStopped = true;
  };

  private readonly handleActionEnd = (event: EventTouch): void => {
    if (event.getID() !== this.touchId) {
      return;
    }
    this.updateTouch(event);
    this.queueRelease(this.inputX, this.inputY, this.amplitude);
    this.touchId = null;
    this.resetAxis();
    this.invalidate();
    event.propagationStopped = true;
  };

  private readonly handleActionCancel = (event: EventTouch): void => {
    if (event.getID() !== this.touchId) {
      return;
    }
    this.touchId = null;
    this.resetAxis();
    this.invalidate();
    event.propagationStopped = true;
  };

  private updateTouch(event: EventTouch): void {
    event.getUILocation(this.touchLocation);
    this.touchWorld.set(this.touchLocation.x, this.touchLocation.y, 0);
    this.actionNode.getComponent(UITransform)?.convertToNodeSpaceAR(
      this.touchWorld,
      this.touchLocal,
    );
    const length = Math.hypot(this.touchLocal.x, this.touchLocal.y);
    const inverseLength = length > 0.000001 ? 1 / length : 0;
    this.inputX = this.touchLocal.x * inverseLength;
    this.inputY = this.touchLocal.y * inverseLength;
    this.amplitude = Math.min(1, length / CENTER_RADIUS);
    this.invalidate();
  }

  private queueRelease(x: number, y: number, amplitude: number): void {
    this.released = true;
    this.releasedX = x;
    this.releasedY = y;
    this.releasedAmplitude = amplitude;
  }

  private cancelInput(): void {
    this.touchId = null;
    this.keyboardActive = false;
    this.released = false;
    this.resetAxis();
  }

  private resetAxis(): void {
    this.inputX = 0;
    this.inputY = 0;
    this.amplitude = 0;
  }

  private updatePresentation(): void {
    const definitions = this.registry.ordered;
    const selected = this.selectedModule;
    const selectedIndex = definitions.findIndex((definition) => definition.id === selected);
    const count = definitions.length;
    const indices = [
      (selectedIndex - 1 + count) % count,
      selectedIndex,
      (selectedIndex + 1) % count,
    ];
    for (let slotIndex = 0; slotIndex < this.slots.length; slotIndex++) {
      const definitionIndex = indices[slotIndex] ?? 0;
      const definition = definitions[definitionIndex];
      const slot = this.slots[slotIndex];
      if (definition === undefined || slot === undefined) {
        continue;
      }
      slot.id = definition.id;
      slot.icon = definition.icon;
      slot.x = this.centerX + (slotIndex - 1) * SIDE_OFFSET_X;
      slot.y = this.centerY + (slotIndex === 1 ? 0 : SIDE_OFFSET_Y);
      slot.radius = slotIndex === 1 ? CENTER_RADIUS : SIDE_RADIUS;
      slot.selected = slotIndex === 1;
      slot.available = this.available[definition.id] ?? false;
    }
    this.reasonLabel.string = getReasonText(this.reasons[selected]
      ?? BattlefieldCombatModuleUnavailableReason.ReservedSlot);
    this.reasonLabel.node.active = this.reasonLabel.string.length > 0;
    this.invalidate();
  }

  private invalidate(): void {
    this.revision = this.revision >= Number.MAX_SAFE_INTEGER ? 1 : this.revision + 1;
  }
}

function createHitNode(parent: Node, name: string, size: number): Node {
  const node = new Node(name);
  node.layer = Layers.Enum.UI_2D;
  parent.addChild(node);
  node.addComponent(UITransform).setContentSize(size, size);
  return node;
}

function createReasonLabel(parent: Node): Label {
  const node = new Node('SkillUnavailableReason');
  node.layer = Layers.Enum.UI_2D;
  parent.addChild(node);
  const transform = node.addComponent(UITransform);
  transform.setContentSize(180, 28);
  const label = node.addComponent(Label);
  label.cacheMode = Label.CacheMode.CHAR;
  label.overflow = Label.Overflow.CLAMP;
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  label.fontSize = 16;
  label.lineHeight = 20;
  label.color = new Color(164, 179, 184, 235);
  return label;
}

function getReasonText(reason: BattlefieldCombatModuleUnavailableReason): string {
  switch (reason) {
    case BattlefieldCombatModuleUnavailableReason.None:
      return '';
    case BattlefieldCombatModuleUnavailableReason.AlreadyCarrying:
      return '正在携带目标';
    case BattlefieldCombatModuleUnavailableReason.NeedsCarriedTarget:
      return '需要先抓取目标';
    case BattlefieldCombatModuleUnavailableReason.ReservedSlot:
      return '预留模块位';
  }
}
