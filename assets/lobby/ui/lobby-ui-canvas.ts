import { Camera, Canvas, Layers, Node, UITransform, view } from 'cc';

const UI_CAMERA_PRIORITY = 1 << 30;
const UI_CAMERA_FAR_CLIP = 2000;

/** 管理大厅屏幕空间 UI 独占的 Canvas、正交相机和窗口尺寸同步。 */
export class LobbyUiCanvas {
  public readonly node: Node;
  private readonly transform: UITransform;
  private disposed = false;

  constructor(parent: Node) {
    const node = new Node('LobbyUiCanvas');
    node.layer = Layers.Enum.UI_2D;
    parent.addChild(node);
    try {
      const transform = node.addComponent(UITransform);
      synchronizeUiCanvasFrame(node, transform);

      const camera = createUiCamera(node);
      const canvas = node.addComponent(Canvas);
      canvas.cameraComponent = camera;
      canvas.alignCanvasWithScreen = true;

      this.node = node;
      this.transform = transform;
    } catch (error: unknown) {
      if (node.isValid) {
        node.destroy();
      }
      throw error;
    }
  }

  /** 在窗口尺寸变化后同步 Canvas 的设计尺寸和中心位置。 */
  public synchronizeFrame(): void {
    if (this.disposed) {
      return;
    }
    synchronizeUiCanvasFrame(this.node, this.transform);
  }

  /** 销毁 Canvas 及其独占的 UI 相机。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    if (this.node.isValid) {
      this.node.destroy();
    }
    this.disposed = true;
  }
}

/** 创建只渲染 UI_2D 层并覆盖在三维相机之后的正交相机。 */
function createUiCamera(parent: Node): Camera {
  const cameraNode = new Node('LobbyUiCamera');
  cameraNode.layer = Layers.Enum.DEFAULT;
  parent.addChild(cameraNode);
  cameraNode.setPosition(0, 0, 1000);

  const camera = cameraNode.addComponent(Camera);
  camera.projection = Camera.ProjectionType.ORTHO;
  camera.priority = UI_CAMERA_PRIORITY;
  camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
  camera.visibility = Layers.Enum.UI_2D;
  camera.near = 1;
  camera.far = UI_CAMERA_FAR_CLIP;
  return camera;
}

/** 根据当前可见设计尺寸更新 Canvas 变换。 */
function synchronizeUiCanvasFrame(node: Node, transform: UITransform): void {
  const visibleSize = view.getVisibleSize();
  const centerX = visibleSize.width * 0.5;
  const centerY = visibleSize.height * 0.5;
  const sizeMatches = transform.width === visibleSize.width
    && transform.height === visibleSize.height;
  const position = node.position;
  const positionMatches = position.x === centerX && position.y === centerY;
  if (sizeMatches && positionMatches) {
    return;
  }
  if (!sizeMatches) {
    transform.setContentSize(visibleSize.width, visibleSize.height);
  }
  if (!positionMatches) {
    node.setPosition(centerX, centerY, 0);
  }
}
