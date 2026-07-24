import { Camera, Color, Graphics, Node, Vec3 } from 'cc';
import {
  BattlefieldActionPreviewType,
  type MutableBattlefieldActionPreview,
} from '../action-modules/model/battlefield-action-preview';

const INVALID_COLOR = new Color(229, 93, 65, 235);
const GRAB_IDLE_COLOR = new Color(59, 131, 181, 190);
const GRAB_TARGET_COLOR = new Color(87, 205, 255, 255);
const THROW_COLOR = new Color(238, 178, 89, 245);
const TRAJECTORY_SAMPLE_COUNT = 9;

/** 把世界空间抓取/投掷预览投影到战场共享 UI Graphics。 */
export class BattlefieldActionPreviewHud {
  private readonly presentation: MutableBattlefieldActionPreview = {
    type: BattlefieldActionPreviewType.None,
    active: false,
    valid: false,
    blocked: false,
    startX: 0,
    startY: 0,
    startZ: 0,
    endX: 0,
    endY: 0,
    endZ: 0,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    impactRadius: 0,
    arcHeight: 0,
  };
  private readonly worldPoint = new Vec3();
  private readonly uiPoint = new Vec3();
  private readonly uiRadiusPoint = new Vec3();
  private revision = 1;

  constructor(
    private readonly canvasNode: Node,
    private readonly camera: Camera,
  ) {}

  public get graphicsRevision(): number {
    return this.revision;
  }

  /** 复制 World 的稳定预览快照，避免 UI 持有可变玩法状态。 */
  public present(source: Readonly<MutableBattlefieldActionPreview>): void {
    if (equalsPreview(this.presentation, source)) {
      return;
    }
    copyPreview(source, this.presentation);
    this.revision = this.revision >= Number.MAX_SAFE_INTEGER ? 1 : this.revision + 1;
  }

  public draw(graphics: Graphics): void {
    const preview = this.presentation;
    if (!preview.active || preview.type === BattlefieldActionPreviewType.None) {
      return;
    }
    if (preview.type === BattlefieldActionPreviewType.Grab) {
      this.drawGrab(graphics, preview);
      return;
    }
    this.drawThrow(graphics, preview);
  }

  private drawGrab(
    graphics: Graphics,
    preview: Readonly<MutableBattlefieldActionPreview>,
  ): void {
    const startX = this.project(preview.startX, preview.startY, preview.startZ).x;
    const startY = this.uiPoint.y;
    const endX = this.project(preview.endX, preview.endY, preview.endZ).x;
    const endY = this.uiPoint.y;
    graphics.strokeColor = preview.valid ? GRAB_TARGET_COLOR : GRAB_IDLE_COLOR;
    graphics.fillColor = graphics.strokeColor;
    graphics.lineWidth = preview.valid ? 5 : 3;
    graphics.moveTo(startX, startY);
    graphics.lineTo(endX, endY);
    graphics.stroke();
    drawArrowHead(graphics, startX, startY, endX, endY, 15);
    if (!preview.valid) {
      return;
    }
    const target = this.project(preview.targetX, preview.targetY, preview.targetZ);
    graphics.lineWidth = 3;
    graphics.circle(target.x, target.y, 17);
    graphics.stroke();
    graphics.moveTo(target.x - 9, target.y + 22);
    graphics.lineTo(target.x, target.y + 31);
    graphics.lineTo(target.x + 9, target.y + 22);
    graphics.stroke();
  }

  private drawThrow(
    graphics: Graphics,
    preview: Readonly<MutableBattlefieldActionPreview>,
  ): void {
    graphics.strokeColor = preview.valid && !preview.blocked ? THROW_COLOR : INVALID_COLOR;
    graphics.fillColor = graphics.strokeColor;
    graphics.lineWidth = 3;
    for (let index = 0; index < TRAJECTORY_SAMPLE_COUNT; index++) {
      const progress = index / (TRAJECTORY_SAMPLE_COUNT - 1);
      const x = preview.startX + (preview.endX - preview.startX) * progress;
      const z = preview.startZ + (preview.endZ - preview.startZ) * progress;
      const linearY = preview.startY + (preview.endY - preview.startY) * progress;
      const y = linearY + preview.arcHeight * 4 * progress * (1 - progress);
      const point = this.project(x, y, z);
      if (index === 0) {
        graphics.moveTo(point.x, point.y);
      } else {
        graphics.lineTo(point.x, point.y);
      }
    }
    graphics.stroke();
    const landing = this.project(preview.endX, preview.endY, preview.endZ);
    const landingX = landing.x;
    const landingY = landing.y;
    const radiusPoint = this.projectRadius(
      preview.endX + Math.max(preview.impactRadius, 0.45),
      preview.endY,
      preview.endZ,
    );
    const radius = Math.max(9, Math.hypot(radiusPoint.x - landingX, radiusPoint.y - landingY));
    graphics.lineWidth = 3;
    graphics.circle(landingX, landingY, radius);
    graphics.stroke();
    graphics.circle(landingX, landingY, 4);
    graphics.fill();
  }

  private project(x: number, y: number, z: number): Vec3 {
    this.worldPoint.set(x, y, z);
    this.camera.convertToUINode(this.worldPoint, this.canvasNode, this.uiPoint);
    return this.uiPoint;
  }

  private projectRadius(x: number, y: number, z: number): Vec3 {
    this.worldPoint.set(x, y, z);
    this.camera.convertToUINode(this.worldPoint, this.canvasNode, this.uiRadiusPoint);
    return this.uiRadiusPoint;
  }
}

function drawArrowHead(
  graphics: Graphics,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  length: number,
): void {
  const angle = Math.atan2(endY - startY, endX - startX);
  graphics.moveTo(endX, endY);
  graphics.lineTo(
    endX - Math.cos(angle - 0.58) * length,
    endY - Math.sin(angle - 0.58) * length,
  );
  graphics.lineTo(
    endX - Math.cos(angle + 0.58) * length,
    endY - Math.sin(angle + 0.58) * length,
  );
  graphics.close();
  graphics.fill();
}

function equalsPreview(
  left: Readonly<MutableBattlefieldActionPreview>,
  right: Readonly<MutableBattlefieldActionPreview>,
): boolean {
  return left.type === right.type
    && left.active === right.active
    && left.valid === right.valid
    && left.blocked === right.blocked
    && left.startX === right.startX
    && left.startY === right.startY
    && left.startZ === right.startZ
    && left.endX === right.endX
    && left.endY === right.endY
    && left.endZ === right.endZ
    && left.targetX === right.targetX
    && left.targetY === right.targetY
    && left.targetZ === right.targetZ
    && left.impactRadius === right.impactRadius
    && left.arcHeight === right.arcHeight;
}

function copyPreview(
  source: Readonly<MutableBattlefieldActionPreview>,
  target: MutableBattlefieldActionPreview,
): void {
  target.type = source.type;
  target.active = source.active;
  target.valid = source.valid;
  target.blocked = source.blocked;
  target.startX = source.startX;
  target.startY = source.startY;
  target.startZ = source.startZ;
  target.endX = source.endX;
  target.endY = source.endY;
  target.endZ = source.endZ;
  target.targetX = source.targetX;
  target.targetY = source.targetY;
  target.targetZ = source.targetZ;
  target.impactRadius = source.impactRadius;
  target.arcHeight = source.arcHeight;
}
