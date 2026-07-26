import { Color, EventTouch, Graphics, Layers, Node, UITransform, Vec2, Vec3 } from 'cc';
import {
  BATTLEFIELD_INVENTORY_CAPACITY,
  type BattlefieldInventorySnapshot,
} from '../model/battlefield-inventory-state';

const SLOT_SIZE = 44;
const SLOT_GAP = 7;
const SECURED_GAP = 16;
const SLOT_FILL = new Color(24, 34, 36, 210);
const SLOT_RIM = new Color(83, 107, 111, 235);
const OCCUPIED = new Color(225, 165, 70, 255);
const SECURED = new Color(120, 205, 190, 255);

/** 固定五格物品栏与撤离锁定格的底部中央交互 HUD。 */
export class BattlefieldInventoryHud {
  private readonly root: Node;
  private readonly slotNodes: readonly Node[];
  private readonly touchLocation = new Vec2();
  private readonly touchWorld = new Vec3();
  private readonly touchLocal = new Vec3();
  private snapshot: Readonly<BattlefieldInventorySnapshot> | null = null;
  private centerY = 0;
  private securedCenterX = 0;
  private activeTouchId: number | null = null;
  private activeSlot = -1;
  private revision = 1;
  private disposed = false;

  constructor(parent: Node, private readonly onSwapWithSecured: (slotIndex: number) => void) {
    const root = new Node('BattlefieldInventoryHud');
    root.layer = Layers.Enum.UI_2D;
    parent.addChild(root);
    root.addComponent(UITransform);
    this.root = root;
    const nodes: Node[] = [];
    for (let index = 0; index < BATTLEFIELD_INVENTORY_CAPACITY; index++) {
      const node = createHitNode(root, `InventorySlot${index + 1}`);
      node.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
        this.beginDrag(index, event);
      });
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

  public synchronizeLayout(width: number, height: number): void {
    const normalWidth = BATTLEFIELD_INVENTORY_CAPACITY * SLOT_SIZE
      + (BATTLEFIELD_INVENTORY_CAPACITY - 1) * SLOT_GAP;
    const totalWidth = normalWidth + SECURED_GAP + SLOT_SIZE;
    const startX = -totalWidth * 0.5 + SLOT_SIZE * 0.5;
    const centerY = -height * 0.5 + SLOT_SIZE * 0.5 + 14;
    for (let index = 0; index < this.slotNodes.length; index++) {
      this.slotNodes[index]?.setPosition(startX + index * (SLOT_SIZE + SLOT_GAP), centerY);
    }
    const securedCenterX = startX + normalWidth + SECURED_GAP;
    if (this.centerY !== centerY || this.securedCenterX !== securedCenterX) {
      this.centerY = centerY;
      this.securedCenterX = securedCenterX;
      this.invalidate();
    }
    this.root.getComponent(UITransform)?.setContentSize(width, height);
  }

  public draw(graphics: Graphics): void {
    const snapshot = this.snapshot;
    if (snapshot === null) {
      return;
    }
    for (let index = 0; index < BATTLEFIELD_INVENTORY_CAPACITY; index++) {
      const node = this.slotNodes[index];
      const slot = snapshot.slots[index];
      if (node === undefined || slot === undefined) {
        continue;
      }
      drawSlot(graphics, node.position.x, this.centerY, slot.occupied, false);
      drawSlotNumber(graphics, node.position.x, this.centerY, index + 1);
    }
    drawSlot(graphics, this.securedCenterX, this.centerY, snapshot.secured.occupied, true);
    drawLock(graphics, this.securedCenterX, this.centerY);
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
    if (id !== null && this.activeTouchId === null) {
      this.activeTouchId = id;
      this.activeSlot = slotIndex;
    }
    event.propagationStopped = true;
  }

  private readonly handleTouchEnd = (event: EventTouch): void => {
    const id = event.getID();
    if (id === null || id !== this.activeTouchId) {
      return;
    }
    event.getUILocation(this.touchLocation);
    this.touchWorld.set(this.touchLocation.x, this.touchLocation.y, 0);
    this.root.getComponent(UITransform)?.convertToNodeSpaceAR(this.touchWorld, this.touchLocal);
    const overSecured = Math.abs(this.touchLocal.x - this.securedCenterX) <= SLOT_SIZE * 0.7
      && Math.abs(this.touchLocal.y - this.centerY) <= SLOT_SIZE * 0.7;
    if (overSecured && this.activeSlot >= 0) {
      this.onSwapWithSecured(this.activeSlot);
    }
    this.clearDrag();
    event.propagationStopped = true;
  };

  private readonly handleTouchCancel = (event: EventTouch): void => {
    const id = event.getID();
    if (id !== null && id === this.activeTouchId) {
      this.clearDrag();
    }
    event.propagationStopped = true;
  };

  private clearDrag(): void {
    this.activeTouchId = null;
    this.activeSlot = -1;
  }

  private invalidate(): void {
    this.revision = this.revision >= Number.MAX_SAFE_INTEGER ? 1 : this.revision + 1;
  }
}

function createHitNode(parent: Node, name: string): Node {
  const node = new Node(name);
  node.layer = Layers.Enum.UI_2D;
  parent.addChild(node);
  node.addComponent(UITransform).setContentSize(SLOT_SIZE, SLOT_SIZE);
  return node;
}

function drawSlot(
  graphics: Graphics,
  x: number,
  y: number,
  occupied: boolean,
  secured: boolean,
): void {
  const half = SLOT_SIZE * 0.5;
  graphics.fillColor = SLOT_FILL;
  graphics.strokeColor = secured ? SECURED : occupied ? OCCUPIED : SLOT_RIM;
  graphics.lineWidth = secured ? 3 : 2;
  graphics.roundRect(x - half, y - half, SLOT_SIZE, SLOT_SIZE, 7);
  graphics.fill();
  graphics.stroke();
  if (occupied) {
    drawHammer(graphics, x, y, secured ? SECURED : OCCUPIED);
  }
}

function drawHammer(graphics: Graphics, x: number, y: number, color: Readonly<Color>): void {
  graphics.strokeColor = color;
  graphics.fillColor = color;
  graphics.lineWidth = 3;
  graphics.moveTo(x - 9, y - 12);
  graphics.lineTo(x + 7, y + 10);
  graphics.stroke();
  graphics.roundRect(x - 13, y + 7, 21, 8, 2);
  graphics.fill();
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
  const offsetX = x - SLOT_SIZE * 0.34;
  const offsetY = y + SLOT_SIZE * 0.32;
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
