import { Graphics, Layers, Node, UITransform } from 'cc';
import { type VirtualJoystick } from '../../../core/ui/virtual-joystick';
import { type BattlefieldInventoryHud } from '../equipment/inventory/ui/battlefield-inventory-hud';
import { type BattlefieldAttackButton } from './battlefield-attack-button';
import { type BattlefieldPlayerStatusHud } from './battlefield-player-status-hud';
import { type BattlefieldRadialSkillButtons } from './battlefield-radial-skill-buttons';

/** 把移动摇杆、攻击按钮、生命条、技能键与物品栏压入同一个 Graphics 组件。 */
export class BattlefieldGameplayGraphics {
  private readonly root: Node;
  private readonly transform: UITransform;
  private readonly graphics: Graphics;
  private movementRevision = -1;
  private attackRevision = -1;
  private playerStatusRevision = -1;
  private skillRevision = -1;
  private inventoryRevision = -1;
  private width = -1;
  private height = -1;
  private disposed = false;

  constructor(canvasNode: Node) {
    const root = new Node('BattlefieldGameplayGraphics');
    root.layer = Layers.Enum.UI_2D;
    canvasNode.addChild(root);
    const transform = root.addComponent(UITransform);
    transform.setAnchorPoint(0.5, 0.5);
    this.root = root;
    this.transform = transform;
    this.graphics = root.addComponent(Graphics);
  }

  /** 任一视觉版本变化时清空并重写唯一共享图形批次。 */
  public synchronize(
    width: number,
    height: number,
    movement: VirtualJoystick,
    attack: BattlefieldAttackButton,
    playerStatus: BattlefieldPlayerStatusHud,
    skills: BattlefieldRadialSkillButtons,
    inventory: BattlefieldInventoryHud,
  ): void {
    if (this.disposed) {
      return;
    }
    const frameChanged = width !== this.width || height !== this.height;
    if (!frameChanged
      && movement.graphicsRevision === this.movementRevision
      && attack.graphicsRevision === this.attackRevision
      && playerStatus.graphicsRevision === this.playerStatusRevision
      && skills.graphicsRevision === this.skillRevision
      && inventory.graphicsRevision === this.inventoryRevision) {
      return;
    }
    if (frameChanged) {
      this.transform.setContentSize(width, height);
      this.width = width;
      this.height = height;
    }
    this.graphics.clear();
    movement.draw(this.graphics);
    attack.draw(this.graphics);
    playerStatus.draw(this.graphics);
    inventory.draw(this.graphics);
    skills.draw(this.graphics);
    this.movementRevision = movement.graphicsRevision;
    this.attackRevision = attack.graphicsRevision;
    this.playerStatusRevision = playerStatus.graphicsRevision;
    this.skillRevision = skills.graphicsRevision;
    this.inventoryRevision = inventory.graphicsRevision;
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
}
