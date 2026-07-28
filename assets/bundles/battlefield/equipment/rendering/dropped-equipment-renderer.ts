import { type Material, Mat4, Node, Quat, Vec3 } from 'cc';
import { MeshDirty } from '../../../../core/mesh/mesh-dirty';
import { DynamicMeshBatch } from '../../../../core/rendering/dynamic-mesh-batch';
import {
  BattlefieldTreasurePerformanceSection,
  type BattlefieldTreasurePerformanceRecorder,
} from '../../debug/battlefield-treasure-performance';
import { getBattlefieldEquipmentPrototype } from '../catalog/battlefield-equipment-catalog';
import { type EquipmentId } from '../catalog/equipment-id';
import {
  createDroppedEquipmentBatchGeometry,
  getDroppedEquipmentActiveIndexCount,
  type DroppedEquipmentBatchGeometry,
  writeDroppedEquipmentBatchPose,
} from '../geometry/dropped-equipment-batch-geometry';
import {
  DROPPED_EQUIPMENT_CONSERVATIVE_BOUNDS,
  DROPPED_EQUIPMENT_PREWARM_Y,
} from './dropped-equipment-conservative-bounds';
import { DroppedEquipmentDirtySlotRange } from './dropped-equipment-dirty-slot-range';

const EQUIPMENT_SURFACE_OPTIONS = Object.freeze({ castShadows: false, receiveShadows: false });

/** 掉落物固定槽位读取的稳定姿态契约。 */
export interface DroppedEquipmentRenderItem {
  readonly worldRuntimeId: number;
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
  private readonly dirtySlots = new DroppedEquipmentDirtySlotRange();
  private activeCount = -1;
  private drawnSlotCount = 0;
  private prewarmed = false;
  private disposed = false;

  constructor(
    parent: Node,
    private readonly items: readonly (DroppedEquipmentRenderItem | null)[],
    private readonly equipmentId: EquipmentId,
    material: Material,
    private readonly performance: BattlefieldTreasurePerformanceRecorder,
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
        DROPPED_EQUIPMENT_CONSERVATIVE_BOUNDS,
        EQUIPMENT_SURFACE_OPTIONS,
      );
      this.batch.setActiveIndexCount(0);
      this.batch.setVisible(false);
    } catch (error: unknown) {
      this.batch.dispose();
      throw error;
    }
  }

  /** 激活一个地面下真实槽位，让本体材质与完整拓扑至少提交一帧。 */
  public prewarm(): void {
    if (this.disposed || this.prewarmed) {
      return;
    }
    const startedAt = this.performance.beginTreasureSection(true);
    const item: DroppedEquipmentRenderItem = {
      worldRuntimeId: 0,
      equipmentId: this.equipmentId,
      poseRevision: 0,
      x: 0,
      y: DROPPED_EQUIPMENT_PREWARM_Y,
      z: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      visible: true,
    };
    this.writePose(0, item);
    const vertexCount = this.packedGeometry.vertexOffsets[1]
      ?? this.packedGeometry.geometry.vertexCount;
    this.batch.uploadVertexAttributeRange(
      MeshDirty.Position | MeshDirty.Color,
      0,
      vertexCount,
    );
    const firstVisibleStartedAt = this.performance.beginTreasureSection(true);
    this.batch.setActiveIndexCount(getDroppedEquipmentActiveIndexCount(
      this.packedGeometry,
      1,
    ));
    this.batch.setVisible(true);
    this.prewarmed = true;
    this.performance.endTreasureSection(
      BattlefieldTreasurePerformanceSection.DroppedBodyUpload,
      startedAt,
      vertexCount,
      vertexCount * 7 * Float32Array.BYTES_PER_ELEMENT,
      0,
      true,
    );
    this.performance.endTreasureSection(
      BattlefieldTreasurePerformanceSection.DroppedFirstVisible,
      firstVisibleStartedAt,
      0,
      0,
      0,
      true,
    );
  }

  /** 在预热 Draw 已提交一帧后清空临时索引范围。 */
  public finishPrewarm(): void {
    if (!this.disposed && this.prewarmed) {
      this.batch.setActiveIndexCount(0);
      this.batch.setVisible(false);
      this.activeCount = 0;
    }
  }

  /** 同步活动前缀；静止且未换槽的物品不会重新计算姿态。 */
  public synchronize(activeCount: number): void {
    if (this.disposed) {
      return;
    }
    validateActiveCount(activeCount, this.items.length);
    const dirtySlots = this.dirtySlots;
    dirtySlots.reset();
    let lastMatchingSlot = -1;
    for (let index = 0; index < activeCount; index++) {
      const item = this.items[index];
      if (item === null || item === undefined) {
        throw new Error('掉落装备活动槽位存在空项。');
      }
      if (item.equipmentId !== this.equipmentId) {
        if ((this.instanceIds[index] ?? -1) !== -1) {
          this.clearSlot(index);
          this.instanceIds[index] = -1;
          this.poseRevisions[index] = 0;
          dirtySlots.include(index);
        }
        continue;
      }
      lastMatchingSlot = index;
      if ((this.instanceIds[index] ?? -1) === item.worldRuntimeId
        && (this.poseRevisions[index] ?? 0) === item.poseRevision) {
        continue;
      }
      this.writePose(index, item);
      this.instanceIds[index] = item.worldRuntimeId;
      this.poseRevisions[index] = item.poseRevision;
      dirtySlots.include(index);
    }
    for (let index = activeCount; index < this.activeCount; index++) {
      this.clearSlot(index);
      this.instanceIds[index] = -1;
      this.poseRevisions[index] = 0;
      dirtySlots.include(index);
    }
    if (dirtySlots.dirty) {
      const firstVertex = this.packedGeometry.vertexOffsets[dirtySlots.firstSlot] ?? 0;
      const endVertex = this.packedGeometry.vertexOffsets[dirtySlots.lastSlot + 1]
        ?? this.packedGeometry.geometry.vertexCount;
      const vertexCount = endVertex - firstVertex;
      const startedAt = this.performance.beginTreasureSection();
      this.batch.uploadVertexAttributeRange(MeshDirty.Position, firstVertex, vertexCount);
      this.performance.endTreasureSection(
        BattlefieldTreasurePerformanceSection.DroppedBodyUpload,
        startedAt,
        vertexCount,
        vertexCount * 3 * Float32Array.BYTES_PER_ELEMENT,
        activeCount,
        false,
      );
    }
    const drawnSlotCount = lastMatchingSlot + 1;
    if (drawnSlotCount !== this.drawnSlotCount) {
      this.batch.setActiveIndexCount(getDroppedEquipmentActiveIndexCount(
        this.packedGeometry,
        drawnSlotCount,
      ));
      this.batch.setVisible(drawnSlotCount > 0);
      this.drawnSlotCount = drawnSlotCount;
    }
    this.activeCount = activeCount;
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

  /** 把退出活动前缀的旧槽位折叠到固定边界内，供回填删除统一上传。 */
  private clearSlot(index: number): void {
    this.position.set(0, DROPPED_EQUIPMENT_PREWARM_Y, 0);
    this.scale.set(1, 1, 1);
    Quat.identity(this.rotation);
    Mat4.fromRTS(this.matrix, this.rotation, this.position, this.scale);
    const source = this.packedGeometry.sources[index];
    const vertexOffset = this.packedGeometry.vertexOffsets[index];
    if (source === undefined || vertexOffset === undefined) {
      throw new Error('掉落装备清理槽位缺少预热几何。');
    }
    writeDroppedEquipmentBatchPose(
      source,
      this.packedGeometry.geometry,
      vertexOffset,
      false,
      this.matrix,
    );
  }
}

function validateActiveCount(activeCount: number, capacity: number): void {
  if (!Number.isInteger(activeCount) || activeCount < 0 || activeCount > capacity) {
    throw new Error('掉落装备活动数量越过固定容量。');
  }
}
