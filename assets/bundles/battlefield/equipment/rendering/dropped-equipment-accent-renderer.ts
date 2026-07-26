import { Node } from 'cc';
import { type MutableGeometryBounds, type UnlitColorBufferGeometry } from '../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../core/mesh/mesh-dirty';
import { DynamicMeshBatch } from '../../../../core/rendering/dynamic-mesh-batch';
import { type BattlefieldEquipmentLibrary } from '../catalog/battlefield-equipment-contracts';
import {
  createDroppedEquipmentBeamGeometry,
  DROPPED_EQUIPMENT_BEAM_TOPOLOGY,
  writeDroppedEquipmentBeam,
} from '../geometry/dropped-equipment-beam-geometry';
import { DROPPED_EQUIPMENT_ACCENT_LAYOUT } from '../model/dropped-equipment-accent-layout';
import { EQUIPMENT_RARITY_PALETTE } from '../model/equipment-rarity-palette';
import { createDroppedEquipmentBeamMaterial } from './dropped-equipment-beam-material';
import { type DroppedEquipmentRenderItem } from './dropped-equipment-renderer';

const BEAM_OPTIONS = Object.freeze({ castShadows: false, receiveShadows: false });
const BEAM_RADIUS = 0.5;

/** 预分配固定容量信标批次，颜色只在槽位身份变化时上传。 */
export class DroppedEquipmentAccentRenderer {
  private readonly material = createDroppedEquipmentBeamMaterial();
  private readonly geometry: UnlitColorBufferGeometry;
  private readonly batch = new DynamicMeshBatch();
  private readonly instanceIds: Int32Array;
  private readonly poseRevisions: Uint32Array;
  private readonly visibleStates: Uint8Array;
  private readonly bounds: MutableGeometryBounds = emptyBounds();
  private activeCount = -1;
  private disposed = false;

  constructor(
    parent: Node,
    private readonly items: readonly (DroppedEquipmentRenderItem | null)[],
    private readonly equipmentLibrary: BattlefieldEquipmentLibrary,
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
        this.bounds,
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

  public synchronize(activeCount: number): void {
    if (this.disposed) {
      return;
    }
    validateActiveCount(activeCount, this.items.length);
    let positionDirty = activeCount !== this.activeCount;
    let colorDirty = false;
    for (let index = 0; index < activeCount; index++) {
      const item = this.items[index];
      if (item === null || item === undefined) {
        throw new Error('掉落装备信标活动范围内存在空槽位。');
      }
      const identityChanged = (this.instanceIds[index] ?? -1) !== item.instanceId;
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
      this.instanceIds[index] = item.instanceId;
      this.poseRevisions[index] = item.poseRevision;
      this.visibleStates[index] = item.visible ? 1 : 0;
      positionDirty = true;
      colorDirty ||= identityChanged || visibilityChanged;
    }
    if ((positionDirty || colorDirty) && activeCount > 0) {
      const dirty = MeshDirty.Position | (colorDirty ? MeshDirty.Color : MeshDirty.None);
      this.batch.uploadVertexAttributes(
        dirty,
        activeCount * DROPPED_EQUIPMENT_BEAM_TOPOLOGY.verticesPerBeam,
      );
      writeBeamBounds(this.items, activeCount, this.bounds);
      this.batch.updateBounds(this.bounds);
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

function writeBeamBounds(
  items: readonly (DroppedEquipmentRenderItem | null)[],
  activeCount: number,
  result: MutableGeometryBounds,
): void {
  const first = items[0];
  if (first === null || first === undefined || activeCount === 0) {
    Object.assign(result, emptyBounds());
    return;
  }
  result.minX = first.x - BEAM_RADIUS;
  result.minY = first.y;
  result.minZ = first.z - BEAM_RADIUS;
  result.maxX = first.x + BEAM_RADIUS;
  result.maxY = first.y + DROPPED_EQUIPMENT_ACCENT_LAYOUT.beamHeight + 0.4;
  result.maxZ = first.z + BEAM_RADIUS;
  for (let index = 1; index < activeCount; index++) {
    const item = items[index];
    if (item === null || item === undefined) {
      throw new Error('掉落装备信标活动范围内存在空槽位。');
    }
    result.minX = Math.min(result.minX, item.x - BEAM_RADIUS);
    result.minY = Math.min(result.minY, item.y);
    result.minZ = Math.min(result.minZ, item.z - BEAM_RADIUS);
    result.maxX = Math.max(result.maxX, item.x + BEAM_RADIUS);
    result.maxY = Math.max(
      result.maxY,
      item.y + DROPPED_EQUIPMENT_ACCENT_LAYOUT.beamHeight + 0.4,
    );
    result.maxZ = Math.max(result.maxZ, item.z + BEAM_RADIUS);
  }
}

function validateActiveCount(activeCount: number, capacity: number): void {
  if (!Number.isInteger(activeCount) || activeCount < 0 || activeCount > capacity) {
    throw new Error('掉落装备信标活动数量越过固定容量。');
  }
}

function emptyBounds(): MutableGeometryBounds {
  return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
}
