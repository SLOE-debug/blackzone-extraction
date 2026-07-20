import {
  BlockInputEvents,
  Graphics,
  HorizontalTextAlignment,
  Label,
  Layers,
  Node,
  UIOpacity,
  UITransform,
  VerticalTextAlignment,
} from 'cc';
import { type LoadingProgress } from '../contracts/loading-progress';
import {
  createLoadingOverlayColor,
  drawSceneLoadingOverlay,
} from './scene-loading-overlay-graphics';
import { SCENE_LOADING_OVERLAY_STYLE } from './scene-loading-overlay-style';
import { useSharedCharacterAtlas } from './shared-character-atlas-label';

/** 可挂到任意屏幕空间 Canvas 的全屏 Loading 转场遮罩。 */
export class SceneLoadingOverlay {
  private readonly root: Node;
  private readonly transform: UITransform;
  private readonly graphicsTransform: UITransform;
  private readonly opacity: UIOpacity;
  private readonly graphics: Graphics;
  private readonly statusLabel: Label;
  private readonly percentageLabel: Label;
  private targetProgress = 0;
  private displayedProgress = 0;
  private animationPhase = 0;
  private failed = false;
  private disposed = false;

  constructor(private readonly canvasNode: Node) {
    const root = createUiNode('SceneLoadingOverlay', canvasNode);
    this.root = root;
    this.transform = root.addComponent(UITransform);
    root.addComponent(BlockInputEvents);
    this.opacity = root.addComponent(UIOpacity);
    this.opacity.opacity = 0;

    const graphicsNode = createUiNode('SceneLoadingOverlayGraphics', root);
    this.graphicsTransform = graphicsNode.addComponent(UITransform);
    this.graphics = graphicsNode.addComponent(Graphics);

    const style = SCENE_LOADING_OVERLAY_STYLE;
    this.statusLabel = createLabel(root, 'SceneLoadingStatus', 22, style.statusY);
    this.percentageLabel = createLabel(root, 'SceneLoadingPercentage', 15, style.percentageY);
    this.statusLabel.string = '正在准备转场';
    this.percentageLabel.string = '0%';
    this.applyLabelPalette();
    this.synchronizeFrame();
    this.redraw();
  }

  /** 更新加载阶段，并驱动进度条平滑追随真实阶段值。 */
  public setProgress(progress: Readonly<LoadingProgress>): void {
    this.ensureActive();
    if (!Number.isFinite(progress.ratio) || progress.ratio < 0 || progress.ratio > 1) {
      throw new Error('Loading 遮罩进度必须位于零到一之间。');
    }
    if (progress.message.trim().length === 0) {
      throw new Error('Loading 遮罩阶段说明不能为空。');
    }
    this.failed = false;
    this.targetProgress = progress.ratio;
    this.statusLabel.string = progress.message;
    this.applyLabelPalette();
  }

  /** 切换到错误提示，短暂保留遮罩以便玩家看清失败原因。 */
  public showFailure(message: string): void {
    this.ensureActive();
    this.failed = true;
    this.statusLabel.string = message;
    this.applyLabelPalette();
    this.redraw();
  }

  /** 推进淡入、呼吸指示点和进度插值。 */
  public update(deltaTime: number): void {
    if (this.disposed) {
      return;
    }
    const safeDeltaTime = Number.isFinite(deltaTime) && deltaTime > 0
      ? Math.min(deltaTime, 0.05)
      : 0;
    this.synchronizeFrame();
    const style = SCENE_LOADING_OVERLAY_STYLE;
    this.opacity.opacity = Math.min(255, this.opacity.opacity + style.fadeSpeed * safeDeltaTime);
    this.animationPhase = (
      this.animationPhase + style.pulseSpeed * safeDeltaTime
    ) % (Math.PI * 2);
    const response = 1 - Math.exp(-style.progressResponse * safeDeltaTime);
    this.displayedProgress += (this.targetProgress - this.displayedProgress) * response;
    if (Math.abs(this.targetProgress - this.displayedProgress) < 0.001) {
      this.displayedProgress = this.targetProgress;
    }
    this.percentageLabel.string = `${Math.round(this.displayedProgress * 100)}%`;
    this.redraw();
  }

  /** 销毁遮罩节点及其输入拦截组件。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    if (this.root.isValid) {
      this.root.destroy();
    }
    this.disposed = true;
  }

  private synchronizeFrame(): void {
    const canvasTransform = this.canvasNode.getComponent(UITransform);
    if (canvasTransform === null) {
      throw new Error('Loading 遮罩必须挂在带 UITransform 的 Canvas 节点下。');
    }
    if (this.transform.width !== canvasTransform.width
      || this.transform.height !== canvasTransform.height) {
      this.transform.setContentSize(canvasTransform.width, canvasTransform.height);
    }
    if (this.graphicsTransform.width !== canvasTransform.width
      || this.graphicsTransform.height !== canvasTransform.height) {
      this.graphicsTransform.setContentSize(canvasTransform.width, canvasTransform.height);
    }
  }

  private redraw(): void {
    drawSceneLoadingOverlay(
      this.graphics,
      this.transform.width,
      this.transform.height,
      this.displayedProgress,
      this.animationPhase,
      this.failed,
    );
  }

  private applyLabelPalette(): void {
    const style = SCENE_LOADING_OVERLAY_STYLE;
    const color = this.failed ? style.error : style.text;
    this.statusLabel.color = createLoadingOverlayColor(color);
    this.percentageLabel.color = createLoadingOverlayColor(this.failed ? style.error : style.accent);
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('Loading 遮罩已经释放。');
    }
  }
}

function createLabel(parent: Node, name: string, fontSize: number, y: number): Label {
  const style = SCENE_LOADING_OVERLAY_STYLE;
  const node = createUiNode(name, parent);
  node.setPosition(0, y, 0);
  node.addComponent(UITransform).setContentSize(style.panelWidth - 72, 36);
  const label = node.addComponent(Label);
  useSharedCharacterAtlas(label);
  label.fontSize = fontSize;
  label.lineHeight = 34;
  label.isBold = true;
  label.horizontalAlign = HorizontalTextAlignment.CENTER;
  label.verticalAlign = VerticalTextAlignment.CENTER;
  label.overflow = Label.Overflow.CLAMP;
  label.enableOutline = false;
  label.color = createLoadingOverlayColor(style.text);
  return label;
}

function createUiNode(name: string, parent: Node): Node {
  const node = new Node(name);
  node.layer = Layers.Enum.UI_2D;
  parent.addChild(node);
  return node;
}
