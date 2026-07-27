import { Node } from 'cc';
import { type UnlitColorBufferGeometry } from '../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../core/mesh/mesh-dirty';
import { DynamicMeshBatch } from '../../../../core/rendering/dynamic-mesh-batch';
import {
  BattlefieldTreasurePerformanceSection,
  type BattlefieldTreasurePerformanceRecorder,
} from '../../debug/battlefield-treasure-performance';
import { type BattlefieldEquipmentLibrary } from '../catalog/battlefield-equipment-contracts';
import { EquipmentId } from '../catalog/equipment-id';
import {
  createDroppedEquipmentBeamGeometry,
  DROPPED_EQUIPMENT_BEAM_TOPOLOGY,
  writeDroppedEquipmentBeam,
} from '../geometry/dropped-equipment-beam-geometry';
import { EQUIPMENT_RARITY_PALETTE } from '../model/equipment-rarity-palette';
import { createDroppedEquipmentBeamMaterial } from './dropped-equipment-beam-material';
import {
  DROPPED_EQUIPMENT_CONSERVATIVE_BOUNDS,
  DROPPED_EQUIPMENT_PREWARM_Y,
} from './dropped-equipment-conservative-bounds';
import { DroppedEquipmentDirtySlotRange } from './dropped-equipment-dirty-slot-range';
import { type DroppedEquipmentRenderItem } from './dropped-equipment-renderer';

const BEAM_OPTIONS = Object.freeze({ castShadows: false, receiveShadows: false });

/** 预分配固定容量信标批次，颜色只在槽位身份变化时上传。 */
export class DroppedEquipmentAccentRenderer {
  private readonly material = createDroppedEquipmentBeamMaterial();
  private readonly geometry: UnlitColorBufferGeometry;
  private readonly batch = new DynamicMeshBatch();
  private readonly instanceIds: Int32Array;
  private readonly poseRevisions: Uint32Array;
  private readonly visibleStates: Uint8Array;
  private readonly dirtySlots = new DroppedEquipmentDirtySlotRange();
  private activeCount = -1;
  private prewarmed = false;
  private disposed = false;

  constructor(
    parent: Node,
    private readonly items: readonly (DroppedEquipmentRenderItem | null)[],
    private readonly equipmentLibrary: BattlefieldEquipmentLibrary,
    private readonly performance: BattlefieldTreasurePerformanceRecorder,
  ) {
    if (items.length === 0) {
      this.material.destroy();
      throw new Error('掉落装备信标容量必须大于零。');
    }
    this.geometry = createDroppedEquipmentBeamGeometry(items.length);
    this.instanceIds = new Int32Array(items.length);
    this.instanceIds.fill(-1);
    this.poseRevisions = new Uint32Array(items.length);
    this.visibleStates = new Uint8Array(items.length);
    try {
      this.batch.initialize(
        parent,
        'DroppedEquipmentBeamBatch',
        this.geometry,
        this.material,
        DROPPED_EQUIPMENT_CONSERVATIVE_BOUNDS,
        BEAM_OPTIONS,
      );
      this.batch.setActiveIndexCount(0);
      this.batch.setVisible(false);
    } catch (error: unknown) {
      this.batch.dispose();
      this.material.destroy();
      throw error;
    }
  }

  /** 激活一个地面下真实信标，预热透明材质、颜色流与完整索引拓扑。 */
  public prewarm(): void {
    if (this.disposed || this.prewarmed) {
      return;
    }
    const startedAt = this.performance.beginTreasureSection(true);
    const color = EQUIPMENT_RARITY_PALETTE[
      this.equipmentLibrary.get(EquipmentId.Sledgehammer).rarity
    ];
    writeDroppedEquipmentBeam(
      this.geometry,
      0,
      0,
      DROPPED_EQUIPMENT_PREWARM_Y,
      0,
      color,
      true,
      true,
    );
    const vertexCount = DROPPED_EQUIPMENT_BEAM_TOPOLOGY.verticesPerBeam;
    this.batch.uploadVertexAttributeRange(
      MeshDirty.Position | MeshDirty.Color,
      0,
      vertexCount,
    );
    const firstVisibleStartedAt = this.performance.beginTreasureSection(true);
    this.batch.setActiveIndexCount(vertexCount);
    this.batch.setVisible(true);
    this.prewarmed = true;
    this.performance.endTreasureSection(
      BattlefieldTreasurePerformanceSection.DroppedAccentUpload,
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

  /** 在信标预热 Draw 提交一帧后清空临时索引范围。 */
  public finishPrewarm(): void {
    if (!this.disposed && this.prewarmed) {
      this.batch.setActiveIndexCount(0);
      this.batch.setVisible(false);
      this.activeCount = 0;
    }
  }

  public synchronize(activeCount: number): void {
    if (this.disposed) {
      return;
    }
    validateActiveCount(activeCount, this.items.length);
    const dirtySlots = this.dirtySlots;
    dirtySlots.reset();
    let colorDirty = false;
    for (let index = 0; index < activeCount; index++) {
      const item = this.items[index];
      if (item === null || item === undefined) {
        throw new Error('掉落装备信标活动范围内存在空槽位。');
      }
      const identityChanged = (this.instanceIds[index] ?? -1) !== item.worldRuntimeId;
      const visibilityChanged = (this.visibleStates[index] ?? 0) !== (item.visible ? 1 : 0);
      if (!identityChanged && !visibilityChanged
        && (this.poseRevisions[index] ?? 0) === item.poseRevision) {
        continue;
      }
      const color = EQUIPMENT_RARITY_PALETTE[
        this.equipmentLibrary.get(item.equipmentId).rarity
      ];
      writeDroppedEquipmentBeam(
        this.geometry,
        index,
        item.x,
        item.y,
        item.z,
        color,
        item.visible,
        identityChanged || visibilityChanged,
      );
      this.instanceIds[index] = item.worldRuntimeId;
      this.poseRevisions[index] = item.poseRevision;
      this.visibleStates[index] = item.visible ? 1 : 0;
      colorDirty ||= identityChanged || visibilityChanged;
      dirtySlots.include(index);
    }
    for (let index = activeCount; index < this.activeCount; index++) {
      const color = EQUIPMENT_RARITY_PALETTE[
        this.equipmentLibrary.get(EquipmentId.Sledgehammer).rarity
      ];
      writeDroppedEquipmentBeam(
        this.geometry,
        index,
        0,
        DROPPED_EQUIPMENT_PREWARM_Y,
        0,
        color,
        false,
        false,
      );
      this.instanceIds[index] = -1;
      this.poseRevisions[index] = 0;
      this.visibleStates[index] = 0;
      dirtySlots.include(index);
    }
    if (dirtySlots.dirty) {
      const dirty = MeshDirty.Position | (colorDirty ? MeshDirty.Color : MeshDirty.None);
      const firstVertex = dirtySlots.firstSlot
        * DROPPED_EQUIPMENT_BEAM_TOPOLOGY.verticesPerBeam;
      const vertexCount = (dirtySlots.lastSlot - dirtySlots.firstSlot + 1)
        * DROPPED_EQUIPMENT_BEAM_TOPOLOGY.verticesPerBeam;
      const startedAt = this.performance.beginTreasureSection();
      this.batch.uploadVertexAttributeRange(
        dirty,
        firstVertex,
        vertexCount,
      );
      const componentCount = colorDirty ? 7 : 3;
      this.performance.endTreasureSection(
        BattlefieldTreasurePerformanceSection.DroppedAccentUpload,
        startedAt,
        vertexCount,
        vertexCount * componentCount * Float32Array.BYTES_PER_ELEMENT,
        activeCount,
        false,
      );
    }
    if (activeCount !== this.activeCount) {
      this.batch.setActiveIndexCount(
        activeCount * DROPPED_EQUIPMENT_BEAM_TOPOLOGY.verticesPerBeam,
      );
      this.batch.setVisible(activeCount > 0);
      this.activeCount = activeCount;
    }
  }

  public dispose(): void {
    if (!this.disposed) {
      this.disposed = true;
      this.batch.dispose();
      this.material.destroy();
    }
  }
}

function validateActiveCount(activeCount: number, capacity: number): void {
  if (!Number.isInteger(activeCount) || activeCount < 0 || activeCount > capacity) {
    throw new Error('掉落装备信标活动数量越过固定容量。');
  }
}
