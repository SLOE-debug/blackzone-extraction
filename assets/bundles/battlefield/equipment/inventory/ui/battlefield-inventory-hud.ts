import { Color, EventTouch, Graphics, Layers, Node, UITransform, Vec2, Vec3 } from 'cc';
import { getBattlefieldEquipmentPrototype } from '../../catalog/battlefield-equipment-catalog';
import {
  BATTLEFIELD_INVENTORY_CAPACITY,
  type BattlefieldInventorySlot,
  type BattlefieldInventorySnapshot,
} from '../model/battlefield-inventory-state';
import { drawBattlefieldEquipmentIcon } from './battlefield-equipment-icon-graphics';
import {
  BattlefieldInventoryHudCommandKind,
  type BattlefieldInventoryHudCommand,
} from './battlefield-inventory-hud-command';
import {
  BATTLEFIELD_INVENTORY_SLOT_SIZE,
  createBattlefieldInventoryLayout,
  findBattlefieldInventorySlotAt,
  isOutsideBattlefieldInventory,
  isOverBattlefieldSecuredSlot,
  type BattlefieldInventoryLayout,
} from './battlefield-inventory-layout';

const DRAG_THRESHOLD_SQUARED = 64;
const SLOT_FILL = new Color(24, 34, 36, 210);
const DRAGGED_FILL = new Color(24, 34, 36, 105);
const SLOT_RIM = new Color(83, 107, 111, 235);
const OCCUPIED = new Color(225, 165, 70, 255);
const SELECTED = new Color(105, 222, 169, 255);
const TARGET = new Color(114, 205, 236, 255);
const DISCARD = new Color(230, 86, 72, 255);
const SECURED = new Color(120, 205, 190, 255);
const GHOST_FILL = new Color(20, 28, 30, 205);

/** 固定五格物品栏与撤离锁定格的点击、换格和拖出丢弃 HUD。 */
export class BattlefieldInventoryHud {
  private readonly root: Node;
  private readonly transform: UITransform;
  private readonly slotNodes: readonly Node[];
  private readonly touchLocation = new Vec2();
  private readonly touchWorld = new Vec3();
  private readonly touchLocal = new Vec3();
  private snapshot: Readonly<BattlefieldInventorySnapshot> | null = null;
  private layout: Readonly<BattlefieldInventoryLayout> | null = null;
  private pendingCommand: BattlefieldInventoryHudCommand | null = null;
  private activeTouchId: number | null = null;
  private activeSlot = -1;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragX = 0;
  private dragY = 0;
  private dragging = false;
  private revision = 1;
  private disposed = false;

  constructor(parent: Node) {
    const root = new Node('BattlefieldInventoryHud');
    root.layer = Layers.Enum.UI_2D;
    parent.addChild(root);
    this.transform = root.addComponent(UITransform);
    this.root = root;
    const nodes: Node[] = [];
    for (let index = 0; index < BATTLEFIELD_INVENTORY_CAPACITY; index++) {
      const node = createHitNode(root, `InventorySlot${index + 1}`);
      node.on(Node.EventType.TOUCH_START, (event: EventTouch) => this.beginDrag(index, event));
      node.on(Node.EventType.TOUCH_MOVE, this.handleTouchMove, this);
      node.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
      node.on(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
      nodes.push(node);
    }
    this.slotNodes = Object.freeze(nodes);
  }

  public get graphicsRevision(): number {
    return this.revision;
  }

  public present(snapshot: Readonly<BattlefieldInventorySnapshot>): void {
    if (this.snapshot?.revision === snapshot.revision) {
      return;
    }
    this.snapshot = snapshot;
    this.invalidate();
  }

  public consumeCommand(): Readonly<BattlefieldInventoryHudCommand> | null {
    const command = this.pendingCommand;
    this.pendingCommand = null;
    return command;
  }

  public synchronizeLayout(width: number, height: number): void {
    const layout = createBattlefieldInventoryLayout(width, height);
    for (let index = 0; index < this.slotNodes.length; index++) {
      this.slotNodes[index]?.setPosition(
        layout.slotCentersX[index] ?? 0,
        layout.centerY,
      );
    }
    this.layout = layout;
    this.transform.setContentSize(width, height);
    this.invalidate();
  }

  public draw(graphics: Graphics): void {
    const snapshot = this.snapshot;
    const layout = this.layout;
    if (snapshot === null || layout === null) {
      return;
    }
    const targetSlot = this.dragging
      ? findBattlefieldInventorySlotAt(layout, this.dragX, this.dragY)
      : -1;
    const overSecured = this.dragging
      && isOverBattlefieldSecuredSlot(layout, this.dragX, this.dragY);
    const discarding = this.dragging
      && isOutsideBattlefieldInventory(layout, this.dragX, this.dragY);
    for (let index = 0; index < BATTLEFIELD_INVENTORY_CAPACITY; index++) {
      const slot = snapshot.slots[index];
      if (slot === undefined) {
        continue;
      }
      const selected = slot.occupied
        && slot.instanceSeed === snapshot.selectedInstanceSeed;
      drawSlot(
        graphics,
        layout.slotCentersX[index] ?? 0,
        layout.centerY,
        slot,
        false,
        selected,
        this.dragging && index === this.activeSlot,
        targetSlot === index && index !== this.activeSlot,
      );
      drawSlotNumber(graphics, layout.slotCentersX[index] ?? 0, layout.centerY, index + 1);
    }
    drawSlot(
      graphics,
      layout.securedCenterX,
      layout.centerY,
      snapshot.secured,
      true,
      false,
      false,
      overSecured,
    );
    drawLock(graphics, layout.securedCenterX, layout.centerY);
    if (this.dragging && this.activeSlot >= 0) {
      const source = snapshot.slots[this.activeSlot];
      if (source?.occupied === true) {
        drawDragGhost(graphics, this.dragX, this.dragY, source, discarding);
      }
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.root.isValid) {
      this.root.destroy();
    }
  }

  private beginDrag(slotIndex: number, event: EventTouch): void {
    const id = event.getID();
    const slot = this.snapshot?.slots[slotIndex];
    if (id === null || this.activeTouchId !== null || slot?.occupied !== true) {
      return;
    }
    this.writeTouchLocal(event);
    this.activeTouchId = id;
    this.activeSlot = slotIndex;
    this.dragStartX = this.touchLocal.x;
    this.dragStartY = this.touchLocal.y;
    this.dragX = this.touchLocal.x;
    this.dragY = this.touchLocal.y;
    this.dragging = false;
    event.propagationStopped = true;
  }

  private readonly handleTouchMove = (event: EventTouch): void => {
    if (!this.matchesActiveTouch(event)) {
      return;
    }
    this.writeTouchLocal(event);
    this.dragX = this.touchLocal.x;
    this.dragY = this.touchLocal.y;
    const deltaX = this.dragX - this.dragStartX;
    const deltaY = this.dragY - this.dragStartY;
    this.dragging ||= deltaX * deltaX + deltaY * deltaY >= DRAG_THRESHOLD_SQUARED;
    this.invalidate();
    event.propagationStopped = true;
  };

  private readonly handleTouchEnd = (event: EventTouch): void => {
    if (!this.matchesActiveTouch(event)) {
      return;
    }
    this.writeTouchLocal(event);
    this.dragX = this.touchLocal.x;
    this.dragY = this.touchLocal.y;
    this.commitGesture();
    this.clearDrag();
    event.propagationStopped = true;
  };

  private readonly handleTouchCancel = (event: EventTouch): void => {
    if (this.matchesActiveTouch(event)) {
      this.clearDrag();
    }
    event.propagationStopped = true;
  };

  private commitGesture(): void {
    const layout = this.layout;
    if (layout === null || this.activeSlot < 0) {
      return;
    }
    if (!this.dragging) {
      this.pendingCommand = Object.freeze({
        kind: BattlefieldInventoryHudCommandKind.SelectSlot,
        slotIndex: this.activeSlot,
      });
      return;
    }
    const targetSlot = findBattlefieldInventorySlotAt(layout, this.dragX, this.dragY);
    if (targetSlot >= 0 && targetSlot !== this.activeSlot) {
      this.pendingCommand = Object.freeze({
        kind: BattlefieldInventoryHudCommandKind.SwapSlots,
        firstSlotIndex: this.activeSlot,
        secondSlotIndex: targetSlot,
      });
    } else if (isOverBattlefieldSecuredSlot(layout, this.dragX, this.dragY)) {
      this.pendingCommand = Object.freeze({
        kind: BattlefieldInventoryHudCommandKind.SwapWithSecured,
        slotIndex: this.activeSlot,
      });
    } else if (isOutsideBattlefieldInventory(layout, this.dragX, this.dragY)) {
      this.pendingCommand = Object.freeze({
        kind: BattlefieldInventoryHudCommandKind.DiscardSlot,
        slotIndex: this.activeSlot,
      });
    }
  }

  private writeTouchLocal(event: EventTouch): void {
    event.getUILocation(this.touchLocation);
    this.touchWorld.set(this.touchLocation.x, this.touchLocation.y, 0);
    this.transform.convertToNodeSpaceAR(this.touchWorld, this.touchLocal);
  }

  private matchesActiveTouch(event: EventTouch): boolean {
    const id = event.getID();
    return id !== null && id === this.activeTouchId;
  }

  private clearDrag(): void {
    this.activeTouchId = null;
    this.activeSlot = -1;
    this.dragging = false;
    this.invalidate();
  }

  private invalidate(): void {
    this.revision = this.revision >= Number.MAX_SAFE_INTEGER ? 1 : this.revision + 1;
  }
}

function createHitNode(parent: Node, name: string): Node {
  const node = new Node(name);
  node.layer = Layers.Enum.UI_2D;
  parent.addChild(node);
  node.addComponent(UITransform).setContentSize(
    BATTLEFIELD_INVENTORY_SLOT_SIZE,
    BATTLEFIELD_INVENTORY_SLOT_SIZE,
  );
  return node;
}

function drawSlot(
  graphics: Graphics,
  x: number,
  y: number,
  slot: Readonly<BattlefieldInventorySlot>,
  secured: boolean,
  selected: boolean,
  dragged: boolean,
  targeted: boolean,
): void {
  const half = BATTLEFIELD_INVENTORY_SLOT_SIZE * 0.5;
  graphics.fillColor = dragged ? DRAGGED_FILL : SLOT_FILL;
  graphics.strokeColor = targeted
    ? TARGET
    : selected
      ? SELECTED
      : secured
        ? SECURED
        : slot.occupied
          ? OCCUPIED
          : SLOT_RIM;
  graphics.lineWidth = targeted || selected || secured ? 3 : 2;
  graphics.roundRect(
    x - half,
    y - half,
    BATTLEFIELD_INVENTORY_SLOT_SIZE,
    BATTLEFIELD_INVENTORY_SLOT_SIZE,
    7,
  );
  graphics.fill();
  graphics.stroke();
  if (slot.occupied && slot.itemId !== null && !dragged) {
    drawBattlefieldEquipmentIcon(
      graphics,
      getBattlefieldEquipmentPrototype(slot.itemId).hud.inventoryIcon,
      x,
      y,
      secured ? SECURED : selected ? SELECTED : OCCUPIED,
    );
  }
}

function drawDragGhost(
  graphics: Graphics,
  x: number,
  y: number,
  slot: Readonly<BattlefieldInventorySlot>,
  discarding: boolean,
): void {
  const color = discarding ? DISCARD : TARGET;
  graphics.fillColor = GHOST_FILL;
  graphics.strokeColor = color;
  graphics.lineWidth = 3;
  graphics.circle(x, y, 24);
  graphics.fill();
  graphics.stroke();
  if (slot.itemId !== null) {
    drawBattlefieldEquipmentIcon(
      graphics,
      getBattlefieldEquipmentPrototype(slot.itemId).hud.inventoryIcon,
      x,
      y,
      color,
    );
  }
  if (discarding) {
    graphics.moveTo(x - 17, y - 17);
    graphics.lineTo(x + 17, y + 17);
    graphics.moveTo(x + 17, y - 17);
    graphics.lineTo(x - 17, y + 17);
    graphics.stroke();
  }
}

function drawLock(graphics: Graphics, x: number, y: number): void {
  graphics.strokeColor = SECURED;
  graphics.lineWidth = 2;
  graphics.arc(x, y + 8, 7, Math.PI, 0, false);
  graphics.stroke();
  graphics.roundRect(x - 8, y - 8, 16, 15, 3);
  graphics.stroke();
}

function drawSlotNumber(graphics: Graphics, x: number, y: number, number: number): void {
  graphics.strokeColor = SLOT_RIM;
  graphics.lineWidth = 2;
  const offsetX = x - BATTLEFIELD_INVENTORY_SLOT_SIZE * 0.34;
  const offsetY = y + BATTLEFIELD_INVENTORY_SLOT_SIZE * 0.32;
  if (number === 1) {
    graphics.moveTo(offsetX, offsetY + 4);
    graphics.lineTo(offsetX + 3, offsetY + 6);
    graphics.lineTo(offsetX + 3, offsetY - 5);
  } else {
    graphics.moveTo(offsetX - 2, offsetY + 5);
    graphics.lineTo(offsetX + 3, offsetY + 5);
    graphics.lineTo(offsetX + 3, offsetY);
    graphics.lineTo(offsetX - 2, offsetY - 5);
  }
  graphics.stroke();
}
