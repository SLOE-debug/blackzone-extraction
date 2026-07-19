import {
  Button,
  Camera,
  Graphics,
  Layers,
  Node,
  UITransform,
  Vec3,
} from 'cc';
import {
  LOBBY_START_BUTTON_STYLE,
  LobbyStartButtonVisualState,
} from '../model/lobby-start-button-style';
import { drawLobbyStartButtonPlate } from './lobby-start-button-graphics';

/** 管理大厅开始按钮的玩家脚下吸附、渲染和交互反馈。 */
export class LobbyStartButton {
  private readonly buttonNode: Node;
  private readonly plateGraphics: Graphics;
  private readonly projectedPosition = new Vec3();
  private visualState: LobbyStartButtonVisualState | null = null;
  private hovered = false;
  private disposed = false;

  constructor(
    private readonly canvasNode: Node,
    private readonly camera: Camera,
    private readonly onStartRequested: () => void,
  ) {
    const canvasTransform = canvasNode.getComponent(UITransform);
    if (canvasTransform === null) {
      throw new Error('大厅开始按钮必须挂在带 UITransform 的 Canvas 下。');
    }
    const buttonElements = createButtonElements(this.canvasNode);
    this.buttonNode = buttonElements.buttonNode;
    this.plateGraphics = buttonElements.plateGraphics;
    try {
      this.buttonNode.on(Node.EventType.MOUSE_ENTER, this.handleMouseEnter, this);
      this.buttonNode.on(Node.EventType.MOUSE_LEAVE, this.handleMouseLeave, this);
      this.buttonNode.on(Node.EventType.TOUCH_START, this.handleTouchStart, this);
      this.buttonNode.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
      this.buttonNode.on(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
      this.buttonNode.on(Button.EventType.CLICK, this.handleClick, this);
      this.applyVisualState(LobbyStartButtonVisualState.Idle);
      this.update();
    } catch (error: unknown) {
      if (this.buttonNode.isValid) {
        this.buttonNode.destroy();
      }
      throw error;
    }
  }

  /** 将玩家脚底世界坐标投影到 UI，并把按钮保持在玩家正下方。 */
  public update(): void {
    if (this.disposed) {
      return;
    }
    const style = LOBBY_START_BUTTON_STYLE;
    const anchor = style.worldAnchor;
    this.projectedPosition.set(anchor.x, anchor.y, anchor.z);
    this.camera.convertToUINode(this.projectedPosition, this.canvasNode, this.projectedPosition);
    this.projectedPosition.y += style.screenOffsetY;
    this.projectedPosition.z = 0;
    this.buttonNode.setPosition(this.projectedPosition);
  }

  /** 解除输入监听并销毁按钮节点。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (!this.buttonNode.isValid) {
      return;
    }
    this.buttonNode.off(Node.EventType.MOUSE_ENTER, this.handleMouseEnter, this);
    this.buttonNode.off(Node.EventType.MOUSE_LEAVE, this.handleMouseLeave, this);
    this.buttonNode.off(Node.EventType.TOUCH_START, this.handleTouchStart, this);
    this.buttonNode.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    this.buttonNode.off(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
    this.buttonNode.off(Button.EventType.CLICK, this.handleClick, this);
    if (this.buttonNode.isValid) {
      this.buttonNode.destroy();
    }
  }

  /** 鼠标进入时切换到更明亮的氧化青铜色。 */
  private handleMouseEnter(): void {
    this.hovered = true;
    this.applyVisualState(LobbyStartButtonVisualState.Hovered);
  }

  /** 鼠标离开时恢复常态色板。 */
  private handleMouseLeave(): void {
    this.hovered = false;
    this.applyVisualState(LobbyStartButtonVisualState.Idle);
  }

  /** 按下时压暗内层分面。 */
  private handleTouchStart(): void {
    this.applyVisualState(LobbyStartButtonVisualState.Pressed);
  }

  /** 松开后按当前指针位置恢复悬停或常态。 */
  private handleTouchEnd(): void {
    this.applyVisualState(
      this.hovered
        ? LobbyStartButtonVisualState.Hovered
        : LobbyStartButtonVisualState.Idle,
    );
  }

  /** 触摸取消时清除按压状态。 */
  private handleTouchCancel(): void {
    this.applyVisualState(
      this.hovered
        ? LobbyStartButtonVisualState.Hovered
        : LobbyStartButtonVisualState.Idle,
    );
  }

  /** 将点击转发给大厅运行时定义的开始游戏请求。 */
  private handleClick(): void {
    this.onStartRequested();
  }

  /** 重绘削角面板并同步文字颜色。 */
  private applyVisualState(state: LobbyStartButtonVisualState): void {
    if (this.visualState === state) {
      return;
    }
    this.visualState = state;
    const palette = LOBBY_START_BUTTON_STYLE.palettes[state];
    drawLobbyStartButtonPlate(this.plateGraphics, palette);
  }
}

/** 创建按钮命中区域、可缩放内容、分面底板和文字。 */
function createButtonElements(parent: Node): Readonly<{
  buttonNode: Node;
  plateGraphics: Graphics;
}> {
  const style = LOBBY_START_BUTTON_STYLE;
  const buttonNode = createUiNode('StartGameButton', parent);
  buttonNode.addComponent(UITransform).setContentSize(style.width, style.height);

  const contentNode = createUiNode('StartGameButtonContent', buttonNode);
  contentNode.addComponent(UITransform).setContentSize(style.width, style.height);

  const plateNode = createUiNode('StartGameButtonPlate', contentNode);
  plateNode.addComponent(UITransform).setContentSize(
    style.width,
    style.height,
  );
  const plateGraphics = plateNode.addComponent(Graphics);

  const button = buttonNode.addComponent(Button);
  button.target = contentNode;
  button.transition = Button.Transition.SCALE;
  button.duration = 0.08;
  button.zoomScale = 1.035;

  return Object.freeze({ buttonNode, plateGraphics });
}

/** 创建并挂接一个只由 UI 相机渲染的节点。 */
function createUiNode(name: string, parent: Node): Node {
  const node = new Node(name);
  node.layer = Layers.Enum.UI_2D;
  parent.addChild(node);
  return node;
}
