import { Graphics, Layers, Node, UITransform } from 'cc';
import { type VirtualJoystick } from '../../../core/ui/virtual-joystick';
import { type BattlefieldPlayerStatusHud } from './battlefield-player-status-hud';
import { type BattlefieldWeaponStatusHud } from './battlefield-weapon-status-hud';

/**
 * 把双摇杆、玩家血条与武器弹药板压入同一个 Graphics 组件。
 *
 * 各交互节点仍独立保留命中区域；只有可见几何集中提交为一个 Graphics 批次，
 * 并且仅在输入、生命值、弹药或布局实际变化时重建路径。
 */
export class BattlefieldGameplayGraphics {
  private readonly root: Node;
  private readonly transform: UITransform;
  private readonly graphics: Graphics;
  private movementRevision = -1;
  private aimRevision = -1;
  private playerStatusRevision = -1;
  private weaponStatusRevision = -1;
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

  /** 在任一视觉版本变化时清空并重写唯一共享图形批次。 */
  public synchronize(
    width: number,
    height: number,
    movement: VirtualJoystick,
    aim: VirtualJoystick,
    playerStatus: BattlefieldPlayerStatusHud,
    weaponStatus: BattlefieldWeaponStatusHud,
  ): void {
    if (this.disposed) {
      return;
    }
    const frameChanged = width !== this.width || height !== this.height;
    if (!frameChanged
      && movement.graphicsRevision === this.movementRevision
      && aim.graphicsRevision === this.aimRevision
      && playerStatus.graphicsRevision === this.playerStatusRevision
      && weaponStatus.graphicsRevision === this.weaponStatusRevision) {
      return;
    }
    if (frameChanged) {
      this.transform.setContentSize(width, height);
      this.width = width;
      this.height = height;
    }
    this.graphics.clear();
    movement.draw(this.graphics);
    aim.draw(this.graphics);
    playerStatus.draw(this.graphics);
    weaponStatus.draw(this.graphics);
    this.movementRevision = movement.graphicsRevision;
    this.aimRevision = aim.graphicsRevision;
    this.playerStatusRevision = playerStatus.graphicsRevision;
    this.weaponStatusRevision = weaponStatus.graphicsRevision;
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
