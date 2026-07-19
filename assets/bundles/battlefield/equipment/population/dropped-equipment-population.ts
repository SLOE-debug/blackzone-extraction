import { type Material, Node } from 'cc';
import { EquipmentId } from '../../../../core/equipment/equipment';
import { type LootScatterTrajectory } from '../../loot/model/loot-scatter-trajectory';
import { createDroppedEquipmentMaterial } from '../rendering/dropped-equipment-material';
import { DroppedEquipmentRuntime } from './dropped-equipment-runtime';

const EQUIPMENT_INSPECTION_RADIUS = 3.5;

/** HUD 复用的最近落地装备结果。 */
export interface MutableDroppedEquipmentInspection {
  equipmentId: EquipmentId;
  x: number;
  y: number;
  z: number;
}

/** 管理一个宝箱爆出的全部掉落装备、共享材质和近距离查询。 */
export class DroppedEquipmentPopulation {
  private readonly material: Material;
  private readonly items: DroppedEquipmentRuntime[] = [];
  private nextInstanceId = 1;
  private disposed = false;

  constructor(
    private readonly parent: Node,
    surfaceMaterialTemplate: Material,
  ) {
    this.material = createDroppedEquipmentMaterial(surfaceMaterialTemplate);
  }

  /** 按一一对应的装备标识和轨迹创建整次爆散。 */
  public spawnBurst(
    equipmentIds: readonly EquipmentId[],
    trajectories: readonly Readonly<LootScatterTrajectory>[],
  ): void {
    this.ensureActive();
    if (equipmentIds.length !== trajectories.length) {
      throw new Error('掉落装备数量必须与爆散轨迹数量一致。');
    }
    const created: DroppedEquipmentRuntime[] = [];
    try {
      for (let index = 0; index < equipmentIds.length; index++) {
        const equipmentId = equipmentIds[index];
        const trajectory = trajectories[index];
        if (equipmentId === undefined || trajectory === undefined) {
          throw new Error('掉落装备或爆散轨迹索引不存在。');
        }
        const item = new DroppedEquipmentRuntime(
          this.parent,
          this.material,
          this.nextInstanceId++,
          equipmentId,
          trajectory,
        );
        created.push(item);
        this.items.push(item);
      }
    } catch (error: unknown) {
      for (const item of created) {
        const itemIndex = this.items.indexOf(item);
        if (itemIndex >= 0) {
          this.items.splice(itemIndex, 1);
        }
        item.dispose();
      }
      throw error;
    }
  }

  public update(deltaTime: number): void {
    if (this.disposed) {
      return;
    }
    for (const item of this.items) {
      item.update(deltaTime);
    }
  }

  /** 查找玩家半径内最近且已经稳定落地的装备。 */
  public writeNearestInspection(
    playerX: number,
    playerZ: number,
    result: MutableDroppedEquipmentInspection,
  ): boolean {
    if (this.disposed) {
      return false;
    }
    const maximumDistanceSquared = EQUIPMENT_INSPECTION_RADIUS * EQUIPMENT_INSPECTION_RADIUS;
    let bestDistanceSquared = maximumDistanceSquared;
    let best: DroppedEquipmentRuntime | null = null;
    for (const item of this.items) {
      if (!item.landed) {
        continue;
      }
      const deltaX = item.x - playerX;
      const deltaZ = item.z - playerZ;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSquared <= bestDistanceSquared) {
        bestDistanceSquared = distanceSquared;
        best = item;
      }
    }
    if (best === null) {
      return false;
    }
    result.equipmentId = best.equipmentId;
    result.x = best.x;
    result.y = best.y + 0.72;
    result.z = best.z;
    return true;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const item of this.items) {
      item.dispose();
    }
    this.items.length = 0;
    this.material.destroy();
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('掉落装备群体已经释放。');
    }
  }
}
