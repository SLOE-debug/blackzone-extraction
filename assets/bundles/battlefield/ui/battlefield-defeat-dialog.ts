import {
  BlockInputEvents,
  Button,
  Graphics,
  HorizontalTextAlignment,
  Label,
  Layers,
  Node,
  UITransform,
  VerticalTextAlignment,
} from 'cc';
import {
  createDefeatDialogColor,
  drawBattlefieldDefeatButton,
  drawBattlefieldDefeatDialog,
} from './battlefield-defeat-dialog-graphics';
import { BATTLEFIELD_DEFEAT_DIALOG_STYLE } from './battlefield-defeat-dialog-style';

const DEFEAT_TITLE = '菜就多练！';
const RETURN_LABEL = '回到大厅';
const RETURN_PENDING_LABEL = '正在返回…';

/** 显示玩家死亡信息，并提供唯一的返回大厅操作。 */
export class BattlefieldDefeatDialog {
  private readonly root: Node;
  private readonly transform: UITransform;
  private readonly graphicsTransform: UITransform;
  private readonly graphics: Graphics;
  private readonly buttonNode: Node;
  private readonly buttonGraphics: Graphics;
  private readonly button: Button;
  private readonly buttonLabel: Label;
  private layoutWidth = -1;
  private layoutHeight = -1;
  private pending = false;
  private disposed = false;

  constructor(
    private readonly canvasNode: Node,
    private readonly onReturnRequested: () => void,
  ) {
    const root = createUiNode('BattlefieldDefeatDialog', canvasNode);
    this.root = root;
    this.transform = root.addComponent(UITransform);
    this.transform.setAnchorPoint(0.5, 0.5);
    root.addComponent(BlockInputEvents);

    const graphicsNode = createUiNode('BattlefieldDefeatDialogGraphics', root);
    this.graphicsTransform = graphicsNode.addComponent(UITransform);
    this.graphicsTransform.setAnchorPoint(0.5, 0.5);
    this.graphics = graphicsNode.addComponent(Graphics);

    const titleNode = createUiNode('BattlefieldDefeatTitle', root);
    const titleStyle = BATTLEFIELD_DEFEAT_DIALOG_STYLE;
    titleNode.setPosition(
      titleStyle.titleOpticalOffsetX,
      titleStyle.titleY,
      0,
    );
    const titleTransform = titleNode.addComponent(UITransform);
    titleTransform.setAnchorPoint(0.5, 0.5);
    titleTransform.setContentSize(titleStyle.titleWidth, titleStyle.titleHeight);
    const title = titleNode.addComponent(Label);
    title.string = DEFEAT_TITLE;
    title.useSystemFont = true;
    title.fontSize = titleStyle.titleFontSize;
    title.lineHeight = titleStyle.titleLineHeight;
    title.isBold = true;
    title.enableWrapText = false;
    title.overflow = Label.Overflow.SHRINK;
    title.horizontalAlign = HorizontalTextAlignment.CENTER;
    title.verticalAlign = VerticalTextAlignment.CENTER;
    title.color = createDefeatDialogColor(titleStyle.title);

    const buttonElements = createReturnButton(root);
    this.buttonNode = buttonElements.node;
    this.buttonGraphics = buttonElements.graphics;
    this.button = buttonElements.button;
    this.buttonLabel = buttonElements.label;
    this.buttonNode.on(Button.EventType.CLICK, this.handleReturnClick, this);
    drawBattlefieldDefeatButton(this.buttonGraphics, false);
    this.synchronizeLayout();
    root.active = false;
  }

  /** 显示弹窗并确保返回按钮处于可操作状态。 */
  public show(): void {
    if (this.disposed) {
      return;
    }
    this.setPending(false);
    this.synchronizeLayout();
    this.root.active = true;
  }

  /** 同步返回 Scene 的等待状态，避免重复点击。 */
  public setPending(pending: boolean): void {
    if (this.disposed || this.pending === pending) {
      return;
    }
    this.pending = pending;
    this.button.interactable = !pending;
    this.buttonLabel.string = pending ? RETURN_PENDING_LABEL : RETURN_LABEL;
    drawBattlefieldDefeatButton(this.buttonGraphics, pending);
  }

  /** 在窗口变化后保持全屏输入遮罩与图形尺寸一致。 */
  public update(): void {
    if (!this.disposed && this.root.active) {
      this.synchronizeLayout();
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (!this.root.isValid) {
      return;
    }
    this.buttonNode.off(Button.EventType.CLICK, this.handleReturnClick, this);
    this.root.destroy();
  }

  private handleReturnClick(): void {
    if (!this.pending) {
      this.onReturnRequested();
    }
  }

  private synchronizeLayout(): void {
    const canvasTransform = this.canvasNode.getComponent(UITransform);
    if (canvasTransform === null) {
      throw new Error('战场死亡弹窗必须挂在带 UITransform 的 Canvas 下。');
    }
    const width = canvasTransform.width;
    const height = canvasTransform.height;
    if (width === this.layoutWidth && height === this.layoutHeight) {
      return;
    }
    this.transform.setContentSize(width, height);
    this.graphicsTransform.setContentSize(width, height);
    drawBattlefieldDefeatDialog(this.graphics, width, height);
    this.layoutWidth = width;
    this.layoutHeight = height;
  }
}

function createReturnButton(parent: Node): Readonly<{
  node: Node;
  graphics: Graphics;
  button: Button;
  label: Label;
}> {
  const style = BATTLEFIELD_DEFEAT_DIALOG_STYLE;
  const node = createUiNode('BattlefieldReturnToLobbyButton', parent);
  node.setPosition(0, style.buttonY, 0);
  const buttonTransform = node.addComponent(UITransform);
  buttonTransform.setAnchorPoint(0.5, 0.5);
  buttonTransform.setContentSize(style.buttonWidth, style.buttonHeight);

  const content = createUiNode('BattlefieldReturnToLobbyContent', node);
  content.setPosition(0, 0, 0);
  const contentTransform = content.addComponent(UITransform);
  contentTransform.setAnchorPoint(0.5, 0.5);
  contentTransform.setContentSize(style.buttonWidth, style.buttonHeight);
  const graphics = content.addComponent(Graphics);

  const labelNode = createUiNode('BattlefieldReturnToLobbyLabel', content);
  labelNode.setPosition(0, 0, 0);
  const labelTransform = labelNode.addComponent(UITransform);
  labelTransform.setAnchorPoint(0.5, 0.5);
  labelTransform.setContentSize(style.buttonWidth, style.buttonHeight);
  const label = labelNode.addComponent(Label);
  label.string = RETURN_LABEL;
  label.useSystemFont = true;
  label.fontSize = style.buttonFontSize;
  label.lineHeight = style.buttonLineHeight;
  label.isBold = true;
  label.enableWrapText = false;
  label.overflow = Label.Overflow.SHRINK;
  label.horizontalAlign = HorizontalTextAlignment.CENTER;
  label.verticalAlign = VerticalTextAlignment.CENTER;
  label.color = createDefeatDialogColor(style.buttonText);

  const button = node.addComponent(Button);
  button.target = content;
  button.transition = Button.Transition.SCALE;
  button.duration = 0.08;
  button.zoomScale = 1.035;
  return Object.freeze({ node, graphics, button, label });
}

function createUiNode(name: string, parent: Node): Node {
  const node = new Node(name);
  node.layer = Layers.Enum.UI_2D;
  parent.addChild(node);
  return node;
}
