import { Node } from 'cc';
import {
  type MutableGeometryBounds,
  type UnlitColorBufferGeometry,
  writePositionBounds,
} from '../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../core/mesh/mesh-dirty';
import { DynamicMeshBatch } from '../../../../core/rendering/dynamic-mesh-batch';
import {
  createDroppedEquipmentBeamGeometry,
  writeDroppedEquipmentBeam,
} from '../geometry/dropped-equipment-beam-geometry';
import {
  EQUIPMENT_RARITY_PALETTE,
  type EquipmentRarityColor,
} from '../model/equipment-rarity-palette';
import { createDroppedEquipmentBeamMaterial } from './dropped-equipment-beam-material';
import { type DroppedEquipmentRenderItem } from './dropped-equipment-renderer';
import { type BattlefieldEquipmentLibrary } from '../catalog/battlefield-equipment-contracts';

const BEAM_OPTIONS = Object.freeze({
  castShadows: false,
  receiveShadows: false,
});

/** 使用单一 Unlit 批次渲染全部掉落物毛笔形光管。 */
export class DroppedEquipmentAccentRenderer {
  private readonly material = createDroppedEquipmentBeamMaterial();
  private readonly geometry: UnlitColorBufferGeometry;
  private readonly batch = new DynamicMeshBatch();
  private readonly colors: readonly Readonly<EquipmentRarityColor>[];
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
    equipmentLibrary: BattlefieldEquipmentLibrary,
  ) {
    if (items.length === 0) {
      this.material.destroy();
      throw new Error('掉落装备强调渲染器至少需要一个实例。');
    }
    this.geometry = createDroppedEquipmentBeamGeometry(items.length);
    this.colors = Object.freeze(items.map((item) => (
      EQUIPMENT_RARITY_PALETTE[equipmentLibrary.get(item.equipmentId).rarity]
    )));
    try {
      const anyVisible = this.writeState();
      writePositionBounds(this.geometry.positions, this.bounds);
      this.batch.initialize(
        parent,
        'DroppedEquipmentBeamBatch',
        this.geometry,
        this.material,
        this.bounds,
        BEAM_OPTIONS,
      );
      this.batch.setVisible(anyVisible);
    } catch (error: unknown) {
      this.batch.dispose();
      this.material.destroy();
      throw error;
    }
  }

  /** 同步飞行或落地姿态，并一次提交整批光管顶点。 */
  public update(): void {
    if (this.disposed) {
      return;
    }
    const anyVisible = this.writeState();
    writePositionBounds(this.geometry.positions, this.bounds);
    this.batch.uploadVertexAttributes(
      MeshDirty.Position | MeshDirty.Color,
      this.geometry.vertexCount,
    );
    this.batch.updateBounds(this.bounds);
    this.batch.setVisible(anyVisible);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.batch.dispose();
    this.material.destroy();
  }

  private writeState(): boolean {
    let anyVisible = false;
    for (let index = 0; index < this.items.length; index++) {
      const item = this.items[index];
      const color = this.colors[index];
      if (item === undefined || color === undefined) {
        throw new Error('掉落装备强调效果没有与实例一一对应。');
      }
      writeDroppedEquipmentBeam(
        this.geometry,
        index,
        item.x,
        item.y,
        item.z,
        color,
        item.visible,
      );
      anyVisible ||= item.visible;
    }
    return anyVisible;
  }
}
