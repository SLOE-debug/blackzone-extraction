import { type Material, Mat4, Node, Quat, Vec3 } from 'cc';
import {
  type MutableGeometryBounds,
  writePositionBounds,
} from '../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../core/mesh/mesh-dirty';
import { DynamicMeshBatch } from '../../../../core/rendering/dynamic-mesh-batch';
import { getBattlefieldEquipmentPrototype } from '../catalog/battlefield-equipment-catalog';
import { type EquipmentId } from '../catalog/equipment-id';
import {
  createDroppedEquipmentBatchGeometry,
  type DroppedEquipmentBatchGeometry,
  writeDroppedEquipmentBatchPose,
} from '../geometry/dropped-equipment-batch-geometry';

const EQUIPMENT_SURFACE_OPTIONS = Object.freeze({
  castShadows: false,
  receiveShadows: false,
});

/** 掉落物大批次读取的稳定姿态契约。 */
export interface DroppedEquipmentRenderItem {
  readonly equipmentId: EquipmentId;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
  readonly visible: boolean;
}

/** 将一次或多次爆散产生的全部掉落装备压入一个动态 MeshRenderer。 */
export class DroppedEquipmentRenderer {
  private readonly packedGeometry: DroppedEquipmentBatchGeometry;
  private readonly batch = new DynamicMeshBatch();
  private readonly rotation = new Quat();
  private readonly matrix = new Mat4();
  private readonly position = new Vec3();
  private readonly scale = new Vec3();
  private readonly bounds: MutableGeometryBounds = {
    minX: 0,
    minY: 0,
    minZ: 0,
    maxX: 0,
    maxY: 0,
    maxZ: 0,
  };
  private disposed = false;

  constructor(
    parent: Node,
    private readonly items: readonly DroppedEquipmentRenderItem[],
    material: Material,
  ) {
    if (items.length === 0) {
      throw new Error('掉落装备批渲染器至少需要一个实例。');
    }
    const sources = Object.freeze(items.map(
      (item) => getBattlefieldEquipmentPrototype(item.equipmentId).geometry,
    ));
    this.packedGeometry = createDroppedEquipmentBatchGeometry(sources);
    const visible = this.writePoses();
    writePositionBounds(this.packedGeometry.geometry.getPositionView(), this.bounds);
    try {
      this.batch.initialize(
        parent,
        'DroppedEquipmentBatch',
        this.packedGeometry.geometry,
        material,
        this.bounds,
        EQUIPMENT_SURFACE_OPTIONS,
      );
      this.batch.setVisible(visible);
    } catch (error: unknown) {
      this.batch.dispose();
      throw error;
    }
  }

  /** 一次性重写全部实例姿态并只上传 Position 缓冲。 */
  public update(): void {
    if (this.disposed) {
      return;
    }
    const visible = this.writePoses();
    writePositionBounds(this.packedGeometry.geometry.getPositionView(), this.bounds);
    this.batch.uploadVertexAttributes(
      MeshDirty.Position,
      this.packedGeometry.geometry.vertexCount,
    );
    this.batch.updateBounds(this.bounds);
    this.batch.setVisible(visible);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.batch.dispose();
  }

  private writePoses(): boolean {
    let anyVisible = false;
    for (let index = 0; index < this.items.length; index++) {
      const item = this.items[index];
      const source = this.packedGeometry.sources[index];
      const vertexOffset = this.packedGeometry.vertexOffsets[index];
      if (item === undefined || source === undefined || vertexOffset === undefined) {
        throw new Error('掉落装备批次实例、几何与顶点区段未能一一对应。');
      }
      anyVisible ||= item.visible;
      const modelScale = getBattlefieldEquipmentPrototype(item.equipmentId).dropped.scale;
      this.position.set(item.x, item.y, item.z);
      this.scale.set(modelScale, modelScale, modelScale);
      Quat.fromEuler(this.rotation, item.rotationX, item.rotationY, item.rotationZ);
      Mat4.fromRTS(this.matrix, this.rotation, this.position, this.scale);
      writeDroppedEquipmentBatchPose(
        source,
        this.packedGeometry.geometry,
        vertexOffset,
        item.visible,
        this.matrix,
      );
    }
    return anyVisible;
  }
}
