import { type Material, Mat4, Node, Quat, Vec3 } from 'cc';
import { type MutableGeometryBounds } from '../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../core/mesh/mesh-dirty';
import { DynamicMeshBatch } from '../../../../core/rendering/dynamic-mesh-batch';
import { getBattlefieldEquipmentPrototype } from '../catalog/battlefield-equipment-catalog';
import { type EquipmentId } from '../catalog/equipment-id';
import {
  createDroppedEquipmentBatchGeometry,
  getDroppedEquipmentActiveIndexCount,
  type DroppedEquipmentBatchGeometry,
  writeDroppedEquipmentBatchPose,
} from '../geometry/dropped-equipment-batch-geometry';

const EQUIPMENT_SURFACE_OPTIONS = Object.freeze({ castShadows: false, receiveShadows: false });

/** 掉落物固定槽位读取的稳定姿态契约。 */
export interface DroppedEquipmentRenderItem {
  readonly instanceId: number;
  readonly equipmentId: EquipmentId;
  readonly poseRevision: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
  readonly visible: boolean;
}

/** 预分配固定容量本体批次，运行期只改写活动槽位前缀。 */
export class DroppedEquipmentRenderer {
  private readonly packedGeometry: DroppedEquipmentBatchGeometry;
  private readonly batch = new DynamicMeshBatch();
  private readonly instanceIds: Int32Array;
  private readonly poseRevisions: Uint32Array;
  private readonly rotation = new Quat();
  private readonly matrix = new Mat4();
  private readonly position = new Vec3();
  private readonly scale = new Vec3();
  private readonly bounds: MutableGeometryBounds = emptyBounds();
  private activeCount = -1;
  private disposed = false;

  constructor(
    parent: Node,
    private readonly items: readonly (DroppedEquipmentRenderItem | null)[],
    private readonly equipmentId: EquipmentId,
    material: Material,
  ) {
    if (items.length === 0) {
      throw new Error('掉落装备批渲染容量必须大于零。');
    }
    const source = getBattlefieldEquipmentPrototype(equipmentId).geometry;
    this.packedGeometry = createDroppedEquipmentBatchGeometry(
      Object.freeze(Array.from({ length: items.length }, () => source)),
    );
    this.instanceIds = new Int32Array(items.length);
    this.instanceIds.fill(-1);
    this.poseRevisions = new Uint32Array(items.length);
    try {
      this.batch.initialize(
        parent,
        'DroppedEquipmentBatch',
        this.packedGeometry.geometry,
        material,
        this.bounds,
        EQUIPMENT_SURFACE_OPTIONS,
      );
      this.batch.setActiveIndexCount(0);
      this.batch.setVisible(false);
    } catch (error: unknown) {
      this.batch.dispose();
      throw error;
    }
  }

  /** 同步活动前缀；静止且未换槽的物品不会重新计算姿态。 */
  public synchronize(activeCount: number): void {
    if (this.disposed) {
      return;
    }
    validateActiveCount(activeCount, this.items.length);
    let positionDirty = activeCount !== this.activeCount;
    for (let index = 0; index < activeCount; index++) {
      const item = this.items[index];
      if (item === null || item === undefined || item.equipmentId !== this.equipmentId) {
        throw new Error('掉落装备活动槽位与预热原型不一致。');
      }
      if ((this.instanceIds[index] ?? -1) === item.instanceId
        && (this.poseRevisions[index] ?? 0) === item.poseRevision) {
        continue;
      }
      this.writePose(index, item);
      this.instanceIds[index] = item.instanceId;
      this.poseRevisions[index] = item.poseRevision;
      positionDirty = true;
    }
    if (positionDirty && activeCount > 0) {
      const activeVertexCount = this.packedGeometry.vertexOffsets[activeCount]
        ?? this.packedGeometry.geometry.vertexCount;
      this.batch.uploadVertexAttributes(MeshDirty.Position, activeVertexCount);
      writeItemBounds(this.items, activeCount, this.bounds);
      this.batch.updateBounds(this.bounds);
    }
    if (activeCount !== this.activeCount) {
      this.batch.setActiveIndexCount(getDroppedEquipmentActiveIndexCount(
        this.packedGeometry,
        activeCount,
      ));
      this.batch.setVisible(activeCount > 0);
      this.activeCount = activeCount;
    }
  }

  public dispose(): void {
    if (!this.disposed) {
      this.disposed = true;
      this.batch.dispose();
    }
  }

  private writePose(index: number, item: Readonly<DroppedEquipmentRenderItem>): void {
    const source = this.packedGeometry.sources[index];
    const vertexOffset = this.packedGeometry.vertexOffsets[index];
    if (source === undefined || vertexOffset === undefined) {
      throw new Error('掉落装备预热几何槽位缺失。');
    }
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
}

function writeItemBounds(
  items: readonly (DroppedEquipmentRenderItem | null)[],
  activeCount: number,
  result: MutableGeometryBounds,
): void {
  const first = items[0];
  if (first === null || first === undefined || activeCount === 0) {
    Object.assign(result, emptyBounds());
    return;
  }
  const firstRadius = getBattlefieldEquipmentPrototype(first.equipmentId).dropped.boundsRadius;
  result.minX = first.x - firstRadius;
  result.minY = first.y - firstRadius;
  result.minZ = first.z - firstRadius;
  result.maxX = first.x + firstRadius;
  result.maxY = first.y + firstRadius;
  result.maxZ = first.z + firstRadius;
  for (let index = 1; index < activeCount; index++) {
    const item = items[index];
    if (item === null || item === undefined) {
      throw new Error('掉落装备活动范围内存在空槽位。');
    }
    const radius = getBattlefieldEquipmentPrototype(item.equipmentId).dropped.boundsRadius;
    result.minX = Math.min(result.minX, item.x - radius);
    result.minY = Math.min(result.minY, item.y - radius);
    result.minZ = Math.min(result.minZ, item.z - radius);
    result.maxX = Math.max(result.maxX, item.x + radius);
    result.maxY = Math.max(result.maxY, item.y + radius);
    result.maxZ = Math.max(result.maxZ, item.z + radius);
  }
}

function validateActiveCount(activeCount: number, capacity: number): void {
  if (!Number.isInteger(activeCount) || activeCount < 0 || activeCount > capacity) {
    throw new Error('掉落装备活动数量越过固定容量。');
  }
}

function emptyBounds(): MutableGeometryBounds {
  return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
}
