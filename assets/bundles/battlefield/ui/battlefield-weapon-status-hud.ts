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
import { type WeaponAmmunitionStatus } from '../equipment/model/weapon-ammunition-status';
import { drawBattlefieldWeaponStatus } from './battlefield-weapon-status-graphics';
import { BATTLEFIELD_WEAPON_STATUS_STYLE } from './battlefield-weapon-status-style';

/** 在右上角生命条下方用单行细条呈现口径和弹药。 */
export class BattlefieldWeaponStatusHud {
  private readonly root: Node;
  private readonly nameLabel: Label;
  private readonly ammunitionLabel: Label;
  private visible = false;
  private roundsRemaining = 0;
  private magazineCapacity = 1;
  private reserveRounds = 0;
  private reloading = false;
  private reloadProgress = 0;
  private currentText = '';
  private layoutWidth = -1;
  private layoutHeight = -1;
  private revision = 1;
  private disposed = false;

  constructor(canvasNode: Node) {
    const style = BATTLEFIELD_WEAPON_STATUS_STYLE;
    const root = createUiNode('BattlefieldWeaponStatus', canvasNode);
    root.addComponent(UITransform).setContentSize(style.panelWidth, style.panelHeight);
    this.nameLabel = createLabel(
      root,
      'BattlefieldWeaponName',
      style.nameLabelWidth,
      style.nameFontSize,
      style.nameLineHeight,
    );
    this.nameLabel.node.setPosition(-28, 0, 0);
    this.nameLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    this.ammunitionLabel = createLabel(
      root,
      'BattlefieldWeaponAmmunition',
      style.ammunitionLabelWidth,
      style.ammunitionFontSize,
      style.ammunitionLineHeight,
    );
    this.ammunitionLabel.node.setPosition(34, 0, 0);
    this.ammunitionLabel.horizontalAlign = HorizontalTextAlignment.RIGHT;
    this.ammunitionLabel.color = new Color(
      style.magazine.red,
      style.magazine.green,
      style.magazine.blue,
      style.magazine.alpha,
    );
    this.root = root;
    root.active = false;
  }

  public get graphicsRevision(): number {
    return this.revision;
  }

  /** 把当前面板写入共享 HUD Graphics；未装备武器时不产生路径。 */
  public draw(graphics: Graphics): void {
    if (!this.visible) {
      return;
    }
    drawBattlefieldWeaponStatus(
      graphics,
      this.root.position.x,
      this.root.position.y,
      this.root.scale.x,
      this.roundsRemaining / this.magazineCapacity,
      this.reloading,
      this.reloadProgress,
    );
  }

  /** 更新稳定弹药快照，只在可见内容实际变化时刷新文字和图形版本。 */
  public present(status: Readonly<WeaponAmmunitionStatus> | null): void {
    if (this.disposed) {
      return;
    }
    if (status === null) {
      if (this.visible) {
        this.visible = false;
        this.root.active = false;
        this.invalidateGraphics();
      }
      return;
    }
    const reloadProgress = status.reloading
      ? Math.round(status.reloadProgress * 100) / 100
      : 0;
    const text = status.reloading
      ? `R ${Math.round(reloadProgress * 100)}%`
      : `${status.roundsRemaining}/${status.reserveRounds}`;
    const changed = !this.visible
      || this.roundsRemaining !== status.roundsRemaining
      || this.magazineCapacity !== status.magazineCapacity
      || this.reserveRounds !== status.reserveRounds
      || this.reloading !== status.reloading
      || this.reloadProgress !== reloadProgress;
    const title = status.caliber;
    if (this.nameLabel.string !== title) {
      this.nameLabel.string = title;
    }
    if (this.currentText !== text) {
      this.currentText = text;
      this.ammunitionLabel.string = text;
    }
    this.visible = true;
    this.root.active = true;
    this.roundsRemaining = status.roundsRemaining;
    this.magazineCapacity = status.magazineCapacity;
    this.reserveRounds = status.reserveRounds;
    this.reloading = status.reloading;
    this.reloadProgress = reloadProgress;
    if (changed) {
      this.invalidateGraphics();
    }
  }

  /** 在可见尺寸变化后贴紧生命条下方的右侧安全边距。 */
  public synchronizeLayout(width: number, height: number): void {
    if (this.disposed || (width === this.layoutWidth && height === this.layoutHeight)) {
      return;
    }
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error('武器 HUD 布局尺寸必须是有限正数。');
    }
    const style = BATTLEFIELD_WEAPON_STATUS_STYLE;
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

function createLabel(
  parent: Node,
  name: string,
  width: number,
  fontSize: number,
  lineHeight: number,
): Label {
  const style = BATTLEFIELD_WEAPON_STATUS_STYLE;
  const node = createUiNode(name, parent);
  node.addComponent(UITransform).setContentSize(width, style.labelHeight);
  const label = node.addComponent(Label);
  useSharedCharacterAtlas(label);
  label.fontSize = fontSize;
  label.lineHeight = lineHeight;
  label.isBold = true;
  label.overflow = Label.Overflow.CLAMP;
  label.horizontalAlign = HorizontalTextAlignment.CENTER;
  label.verticalAlign = VerticalTextAlignment.CENTER;
  label.color = new Color(
    style.reserve.red,
    style.reserve.green,
    style.reserve.blue,
    style.reserve.alpha,
  );
  return label;
}

function createUiNode(name: string, parent: Node): Node {
  const node = new Node(name);
  node.layer = Layers.Enum.UI_2D;
  parent.addChild(node);
  return node;
}
