import { Graphics, Layers, Node, UITransform } from 'cc';
import { type VirtualJoystick } from '../../../core/ui/virtual-joystick';

/** 独立刷新右侧瞄准摇杆，避免拖动时重建物品栏与全部战斗 HUD。 */
export class BattlefieldAimJoystickGraphics {
  private readonly root: Node;
  private readonly transform: UITransform;
  private readonly graphics: Graphics;
  private revision = -1;
  private width = -1;
  private height = -1;

  constructor(parent: Node) {
    const root = new Node('BattlefieldAimJoystickGraphics');
    root.layer = Layers.Enum.UI_2D;
    parent.addChild(root);
    this.root = root;
    this.transform = root.addComponent(UITransform);
    this.transform.setAnchorPoint(0.5, 0.5);
    this.graphics = root.addComponent(Graphics);
  }

  public synchronize(width: number, height: number, joystick: VirtualJoystick): void {
    const frameChanged = width !== this.width || height !== this.height;
    if (!frameChanged && joystick.graphicsRevision === this.revision) {
      return;
    }
    if (frameChanged) {
      this.transform.setContentSize(width, height);
      this.width = width;
      this.height = height;
    }
    this.graphics.clear();
    joystick.draw(this.graphics);
    this.revision = joystick.graphicsRevision;
  }

  public dispose(): void {
    if (this.root.isValid) {
      this.root.destroy();
    }
  }
}
