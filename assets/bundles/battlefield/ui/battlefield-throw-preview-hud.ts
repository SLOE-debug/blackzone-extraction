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

const INVALID_COLOR = new Color(229, 93, 65, 235);
const THROW_COLOR = new Color(238, 178, 89, 245);
const TRAJECTORY_SAMPLE_COUNT = 9;

/** 只负责把三维投掷弧线和落点投影到屏幕空间。 */
export class BattlefieldThrowPreviewHud {
  private readonly presentation = createBattlefieldActionPreviewSnapshot();
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

  public present(source: Readonly<MutableBattlefieldActionPreview>): void {
    if (equalsBattlefieldActionPreview(this.presentation, source)) {
      return;
    }
    copyBattlefieldActionPreview(source, this.presentation);
    this.revision = this.revision >= Number.MAX_SAFE_INTEGER ? 1 : this.revision + 1;
  }

  public draw(graphics: Graphics): void {
    const preview = this.presentation;
    if (!preview.active || preview.type !== BattlefieldActionPreviewType.Throw) {
      return;
    }
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
