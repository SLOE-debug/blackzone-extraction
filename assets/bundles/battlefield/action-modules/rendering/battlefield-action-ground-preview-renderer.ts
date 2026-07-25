import { Color, Node } from 'cc';
import {
  type MutableGeometryBounds,
  writePositionBounds,
} from '../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../core/mesh/mesh-dirty';
import { DynamicMeshBatch } from '../../../../core/rendering/dynamic-mesh-batch';
import { TransparentUnlitMaterialFactory } from '../../../../core/rendering/transparent-unlit-material-factory';
import {
  createBattlefieldActionGroundPreviewGeometry,
  writeBattlefieldActionGroundPreviewGeometry,
} from '../geometry/battlefield-action-ground-preview-geometry';
import {
  BattlefieldActionPreviewType,
  type MutableBattlefieldActionPreview,
} from '../model/battlefield-action-preview';

const BATCH_OPTIONS = Object.freeze({
  castShadows: false,
  receiveShadows: false,
});
const FLOW_SPEED = 0.82;

/** 在玩家脚下渲染抓取楔形、最大距离边沿与流动符文。 */
export class BattlefieldActionGroundPreviewRenderer {
  private readonly geometry = createBattlefieldActionGroundPreviewGeometry();
  private readonly material = TransparentUnlitMaterialFactory.create({
    name: 'BattlefieldActionGroundPreviewMaterial',
    mainColor: new Color(255, 255, 255, 255),
    useVertexColor: true,
  });
  private readonly batch = new DynamicMeshBatch();
  private readonly bounds: MutableGeometryBounds = {
    minX: 0,
    minY: 0,
    minZ: 0,
    maxX: 0,
    maxY: 0,
    maxZ: 0,
  };
  private flowPhase = 0;
  private visible = false;
  private disposed = false;

  constructor(parent: Node) {
    writeBattlefieldActionGroundPreviewGeometry(
      this.geometry,
      0,
      0,
      0,
      0,
      1,
      0,
      3.8,
      false,
      0,
    );
    writePositionBounds(this.geometry.positions, this.bounds);
    try {
      this.batch.initialize(
        parent,
        'BattlefieldActionGroundPreview',
        this.geometry,
        this.material,
        this.bounds,
        BATCH_OPTIONS,
      );
      this.batch.setVisible(false);
    } catch (error: unknown) {
      this.batch.dispose();
      this.material.destroy();
      throw error;
    }
  }

  /** 同步抓取世界预览；非抓取状态不进入渲染提交列表。 */
  public present(
    preview: Readonly<MutableBattlefieldActionPreview>,
    deltaTime: number,
  ): void {
    if (this.disposed) {
      return;
    }
    const active = preview.active && preview.type === BattlefieldActionPreviewType.Grab;
    if (!active) {
      if (this.visible) {
        this.batch.setVisible(false);
        this.visible = false;
      }
      return;
    }
    const deltaX = preview.endX - preview.startX;
    const deltaZ = preview.endZ - preview.startZ;
    const inverseLength = 1 / Math.max(0.000001, Math.hypot(deltaX, deltaZ));
    const directionX = deltaX * inverseLength;
    const directionZ = deltaZ * inverseLength;
    const safeDeltaTime = Number.isFinite(deltaTime)
      ? Math.max(0, Math.min(deltaTime, 0.1))
      : 0;
    this.flowPhase = (this.flowPhase + safeDeltaTime * FLOW_SPEED) % 1;
    writeBattlefieldActionGroundPreviewGeometry(
      this.geometry,
      preview.startX,
      preview.startY,
      preview.startZ,
      directionX,
      directionZ,
      preview.targetX,
      preview.targetZ,
      preview.valid,
      this.flowPhase,
    );
    writePositionBounds(this.geometry.positions, this.bounds);
    this.batch.uploadVertexAttributes(
      MeshDirty.Position | MeshDirty.Color,
      this.geometry.vertexCount,
    );
    this.batch.updateBounds(this.bounds);
    if (!this.visible) {
      this.batch.setVisible(true);
      this.visible = true;
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.batch.dispose();
    this.material.destroy();
  }
}
