import {
  type Camera,
  Color,
  Graphics,
  HorizontalTextAlignment,
  Label,
  Layers,
  Node,
  UITransform,
  Vec3,
  VerticalTextAlignment,
} from 'cc';
import { useSharedCharacterAtlas } from '../../../../core/ui/shared-character-atlas-label';
import { type BattlefieldEquipmentLibrary } from '../catalog/battlefield-equipment-contracts';
import { EquipmentId } from '../catalog/equipment-id';
import { EQUIPMENT_RARITY_STYLE } from './equipment-rarity-style';

const PANEL_WIDTH = 176;
const PANEL_HEIGHT = 38;
const WORLD_LABEL_OFFSET_Y = 30;
const PANEL_COLOR = new Color(9, 12, 15, 224);

/** 一件靠近玩家的装备在世界标签中所需的最小信息。 */
export interface BattlefieldEquipmentLabelPresentation {
  readonly equipmentId: EquipmentId;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 把装备世界锚点投影到 HUD，并按品质绘制名称颜色与边框。 */
export class BattlefieldEquipmentLabelHud {
  private readonly root: Node;
  private readonly graphics: Graphics;
  private readonly label: Label;
  private readonly worldPosition = new Vec3();
  private readonly localPosition = new Vec3();
  private currentEquipmentId: EquipmentId | null = null;
  private disposed = false;

  constructor(
    private readonly canvasNode: Node,
    private readonly worldCamera: Camera,
    private readonly equipmentLibrary: BattlefieldEquipmentLibrary,
  ) {
    const root = new Node('BattlefieldEquipmentLabel');
    root.layer = Layers.Enum.UI_2D;
    canvasNode.addChild(root);
    root.addComponent(UITransform).setContentSize(PANEL_WIDTH, PANEL_HEIGHT);
    this.graphics = root.addComponent(Graphics);

    const labelNode = new Node('BattlefieldEquipmentLabelText');
    labelNode.layer = Layers.Enum.UI_2D;
    root.addChild(labelNode);
    labelNode.addComponent(UITransform).setContentSize(PANEL_WIDTH - 18, PANEL_HEIGHT - 8);
    const label = labelNode.addComponent(Label);
    useSharedCharacterAtlas(label);
    label.fontSize = 14;
    label.lineHeight = 18;
    label.isBold = true;
    label.horizontalAlign = HorizontalTextAlignment.CENTER;
    label.verticalAlign = VerticalTextAlignment.CENTER;
    label.overflow = Label.Overflow.CLAMP;
    this.label = label;
    this.root = root;
    root.active = false;
  }

  /** 显示最近装备；传入 null 时立即隐藏。 */
  public present(presentation: Readonly<BattlefieldEquipmentLabelPresentation> | null): void {
    if (this.disposed) {
      return;
    }
    if (presentation === null) {
      this.root.active = false;
      this.currentEquipmentId = null;
      return;
    }
    if (this.currentEquipmentId !== presentation.equipmentId) {
      this.applyEquipment(presentation.equipmentId);
    }
    this.worldPosition.set(presentation.x, presentation.y, presentation.z);
    this.worldCamera.convertToUINode(this.worldPosition, this.canvasNode, this.localPosition);
    this.localPosition.y += WORLD_LABEL_OFFSET_Y;
    this.localPosition.z = 0;
    this.root.setPosition(this.localPosition);
    this.root.active = true;
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

  private applyEquipment(equipmentId: EquipmentId): void {
    const definition = this.equipmentLibrary.get(equipmentId);
    const rarity = EQUIPMENT_RARITY_STYLE[definition.rarity];
    this.label.string = definition.displayName;
    this.label.color = rarity.color;
    this.graphics.clear();
    drawCutCornerPanel(this.graphics, rarity.color);
    this.currentEquipmentId = equipmentId;
  }
}

/** 绘制带切角的暗色信息板和品质色边框。 */
function drawCutCornerPanel(graphics: Graphics, borderColor: Readonly<Color>): void {
  const halfWidth = PANEL_WIDTH * 0.5;
  const halfHeight = PANEL_HEIGHT * 0.5;
  const cut = 7;
  graphics.moveTo(-halfWidth + cut, halfHeight);
  graphics.lineTo(halfWidth - cut, halfHeight);
  graphics.lineTo(halfWidth, halfHeight - cut);
  graphics.lineTo(halfWidth, -halfHeight + cut);
  graphics.lineTo(halfWidth - cut, -halfHeight);
  graphics.lineTo(-halfWidth + cut, -halfHeight);
  graphics.lineTo(-halfWidth, -halfHeight + cut);
  graphics.lineTo(-halfWidth, halfHeight - cut);
  graphics.close();
  graphics.fillColor = PANEL_COLOR;
  graphics.fill();
  graphics.strokeColor = borderColor;
  graphics.lineWidth = 2;
  graphics.stroke();
}
