import {
  Color,
  Graphics,
  HorizontalTextAlignment,
  Label,
  Layers,
  Node,
  UITransform,
  VerticalTextAlignment,
} from 'cc';
import { useSharedCharacterAtlas } from '../../../core/ui/shared-character-atlas-label';
import { drawBattlefieldPlayerStatus } from './battlefield-player-status-graphics';
import { BATTLEFIELD_PLAYER_STATUS_STYLE } from './battlefield-player-status-style';

/** 在屏幕右上角用单行紧凑血条持续呈现玩家当前生命值。 */
export class BattlefieldPlayerStatusHud {
  private readonly root: Node;
  private readonly label: Label;
  private currentHealth = Number.NaN;
  private maximumHealth = Number.NaN;
  private layoutWidth = -1;
  private layoutHeight = -1;
  private revision = 1;
  private disposed = false;

  constructor(canvasNode: Node) {
    const style = BATTLEFIELD_PLAYER_STATUS_STYLE;
    const root = createUiNode('BattlefieldPlayerStatus', canvasNode);
    const transform = root.addComponent(UITransform);
    transform.setAnchorPoint(0.5, 0.5);
    transform.setContentSize(style.panelWidth, style.panelHeight);

    const labelNode = createUiNode('BattlefieldPlayerHealthLabel', root);
    labelNode.setPosition(0, 0, 0);
    const labelTransform = labelNode.addComponent(UITransform);
    labelTransform.setAnchorPoint(0.5, 0.5);
    labelTransform.setContentSize(style.labelWidth, style.labelHeight);
    const label = labelNode.addComponent(Label);
    useSharedCharacterAtlas(label);
    label.fontSize = style.labelFontSize;
    label.lineHeight = style.labelLineHeight;
    label.isBold = true;
    label.overflow = Label.Overflow.CLAMP;
    label.horizontalAlign = HorizontalTextAlignment.CENTER;
    label.verticalAlign = VerticalTextAlignment.CENTER;
    label.color = new Color(
      style.text.red,
      style.text.green,
      style.text.blue,
      style.text.alpha,
    );

    this.root = root;
    this.label = label;
    this.present(0, 1);
  }

  /** 共享 HUD Graphics 判断血条或布局是否变化使用的单调版本。 */
  public get graphicsRevision(): number {
    return this.revision;
  }

  /** 把当前血条写入 Canvas 坐标系中的共享 Graphics。 */
  public draw(graphics: Graphics): void {
    drawBattlefieldPlayerStatus(
      graphics,
      this.currentHealth / this.maximumHealth,
      this.root.position.x,
      this.root.position.y,
      this.root.scale.x,
    );
  }

  /** 只在生命值实际变化时更新动态文字和 Graphics 顶点。 */
  public present(health: number, maximumHealth: number): void {
    if (this.disposed) {
      return;
    }
    if (!Number.isFinite(health)
      || !Number.isFinite(maximumHealth)
      || maximumHealth <= 0) {
      throw new Error('玩家 HUD 生命值必须有限，且最大生命值必须为正数。');
    }
    const clampedHealth = Math.max(0, Math.min(health, maximumHealth));
    if (clampedHealth === this.currentHealth && maximumHealth === this.maximumHealth) {
      return;
    }
    this.currentHealth = clampedHealth;
    this.maximumHealth = maximumHealth;
    this.label.string = `${Math.ceil(clampedHealth)}`;
    this.invalidateGraphics();
  }

  /** 在可见尺寸变化后保持状态板贴紧右上安全边距。 */
  public synchronizeLayout(width: number, height: number): void {
    if (this.disposed || (width === this.layoutWidth && height === this.layoutHeight)) {
      return;
    }
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error('玩家 HUD 布局尺寸必须是有限正数。');
    }
    const style = BATTLEFIELD_PLAYER_STATUS_STYLE;
    const availableWidth = Math.max(1, width - style.minimumViewportInset * 2);
    const scale = Math.min(1, availableWidth / style.panelWidth);
    this.root.setScale(scale, scale, 1);
    this.root.setPosition(
      width * 0.5 - style.rightInset - style.panelWidth * scale * 0.5,
      height * 0.5 - style.topInset - style.panelHeight * scale * 0.5,
      0,
    );
    this.layoutWidth = width;
    this.layoutHeight = height;
    this.invalidateGraphics();
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

  private invalidateGraphics(): void {
    this.revision = this.revision >= Number.MAX_SAFE_INTEGER ? 1 : this.revision + 1;
  }
}

function createUiNode(name: string, parent: Node): Node {
  const node = new Node(name);
  node.layer = Layers.Enum.UI_2D;
  parent.addChild(node);
  return node;
}
