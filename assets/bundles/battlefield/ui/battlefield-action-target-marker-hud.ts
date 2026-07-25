import { Camera, Color, Graphics, Node, Vec3 } from 'cc';
import {
  BattlefieldActionPreviewType,
  type MutableBattlefieldActionPreview,
} from '../action-modules/model/battlefield-action-preview';
import {
  copyBattlefieldActionPreview,
  createBattlefieldActionPreviewSnapshot,
  equalsBattlefieldActionPreview,
} from './battlefield-action-preview-snapshot';

const LOCK_COLOR = new Color(96, 220, 255, 255);
const LOCK_FILL_COLOR = new Color(38, 126, 181, 170);

/** 只把已经锁定的抓取目标投影为独立屏幕空间技能标记。 */
export class BattlefieldActionTargetMarkerHud {
  private readonly presentation = createBattlefieldActionPreviewSnapshot();
  private readonly worldPoint = new Vec3();
  private readonly uiPoint = new Vec3();
  private revision = 1;

  constructor(
    private readonly canvasNode: Node,
    private readonly camera: Camera,
  ) {}

  public get graphicsRevision(): number {
    return this.revision;
  }

  public present(source: Readonly<MutableBattlefieldActionPreview>): void {
    if (equalsBattlefieldActionPreview(this.presentation, source)) {
      return;
    }
    copyBattlefieldActionPreview(source, this.presentation);
    this.revision = this.revision >= Number.MAX_SAFE_INTEGER ? 1 : this.revision + 1;
  }

  /** 绘制中心锁定菱形和四组内收抓钩，不复用调试圆圈与屋顶折线。 */
  public draw(graphics: Graphics): void {
    const preview = this.presentation;
    if (!preview.active
      || !preview.valid
      || preview.type !== BattlefieldActionPreviewType.Grab) {
      return;
    }
    this.worldPoint.set(preview.targetX, preview.targetY, preview.targetZ);
    this.camera.convertToUINode(this.worldPoint, this.canvasNode, this.uiPoint);
    const x = this.uiPoint.x;
    const y = this.uiPoint.y;
    graphics.strokeColor = LOCK_COLOR;
    graphics.fillColor = LOCK_FILL_COLOR;
    graphics.lineWidth = 3;
    graphics.moveTo(x, y + 9);
    graphics.lineTo(x + 9, y);
    graphics.lineTo(x, y - 9);
    graphics.lineTo(x - 9, y);
    graphics.close();
    graphics.fill();
    graphics.stroke();
    drawLockClaw(graphics, x - 24, y + 24, 1, -1);
    drawLockClaw(graphics, x + 24, y + 24, -1, -1);
    drawLockClaw(graphics, x - 24, y - 24, 1, 1);
    drawLockClaw(graphics, x + 24, y - 24, -1, 1);
  }
}

function drawLockClaw(
  graphics: Graphics,
  x: number,
  y: number,
  horizontalDirection: -1 | 1,
  verticalDirection: -1 | 1,
): void {
  graphics.moveTo(x, y + verticalDirection * 9);
  graphics.lineTo(x, y);
  graphics.lineTo(x + horizontalDirection * 9, y);
  graphics.stroke();
  graphics.moveTo(
    x + horizontalDirection * 4,
    y + verticalDirection * 4,
  );
  graphics.lineTo(
    x + horizontalDirection * 11,
    y + verticalDirection * 11,
  );
  graphics.stroke();
}
