import { type Material, Node } from 'cc';
import {
  EquipmentId,
  type EquipmentLibrary,
} from '../../../../core/equipment/equipment';
import { type LootScatterTrajectory } from '../../loot/model/loot-scatter-trajectory';
import { createDroppedEquipmentMaterial } from '../rendering/dropped-equipment-material';
import { DroppedEquipmentAccentRenderer } from '../rendering/dropped-equipment-accent-renderer';
import { DroppedEquipmentRenderer } from '../rendering/dropped-equipment-renderer';
import { DroppedEquipmentRuntime } from './dropped-equipment-runtime';

const EQUIPMENT_INSPECTION_RADIUS = 3.5;

/** HUD 复用的最近落地装备结果。 */
export interface MutableDroppedEquipmentInspection {
  instanceId: number;
  equipmentId: EquipmentId;
  x: number;
  y: number;
  z: number;
}

/** 为同一战场中的全部掉落装备分配不会跨宝箱冲突的运行时标识。 */
export class DroppedEquipmentInstanceIdSequence {
  private nextInstanceId = 1;

  public allocate(): number {
    if (!Number.isSafeInteger(this.nextInstanceId)) {
      throw new Error('战场掉落装备实例标识已经耗尽。');
    }
    return this.nextInstanceId++;
  }
}

/** 管理战场全部宝箱掉落与玩家丢弃装备的统一渲染、动画和近距离查询。 */
export class DroppedEquipmentPopulation {
  private readonly material: Material;
  private readonly items: DroppedEquipmentRuntime[] = [];
  private renderer: DroppedEquipmentRenderer | null = null;
  private accentRenderer: DroppedEquipmentAccentRenderer | null = null;
  private disposed = false;

  /** 当前仍在世界中的飞行或落地装备数量。 */
  public get count(): number {
    return this.items.length;
  }

  /** 当前掉落物本体与毛笔形信标实际占用的固定全局批次数量。 */
  public get renderBatchCount(): number {
    return (this.renderer === null ? 0 : 1) + (this.accentRenderer === null ? 0 : 1);
  }

  constructor(
    private readonly parent: Node,
    private readonly instanceIds: DroppedEquipmentInstanceIdSequence,
    private readonly equipmentLibrary: EquipmentLibrary,
  ) {
    this.material = createDroppedEquipmentMaterial();
  }

  /** 按一一对应的装备标识和轨迹创建整次爆散。 */
  public spawnBurst(
    equipmentIds: readonly EquipmentId[],
    trajectories: readonly Readonly<LootScatterTrajectory>[],
  ): readonly number[] {
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
          this.instanceIds.allocate(),
          equipmentId,
          trajectory,
        );
        created.push(item);
        this.items.push(item);
      }
      this.rebuildRenderer();
      return Object.freeze(created.map((item) => item.instanceId));
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
    this.renderer?.update();
    this.accentRenderer?.update();
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
    result.instanceId = best.instanceId;
    result.x = best.x;
    result.y = best.y + 0.72;
    result.z = best.z;
    return true;
  }

  /** 返回指定落地实例当前携带的装备标识。 */
  public getEquipmentId(instanceId: number): EquipmentId | null {
    if (this.disposed) {
      return null;
    }
    for (const item of this.items) {
      if (item.instanceId === instanceId && item.landed) {
        return item.equipmentId;
      }
    }
    return null;
  }

  /** 从世界中移除已经被玩家成功装备的落地实例。 */
  public remove(instanceId: number): boolean {
    if (this.disposed) {
      return false;
    }
    const index = this.items.findIndex(
      (item) => item.instanceId === instanceId && item.landed,
    );
    if (index < 0) {
      return false;
    }
    const item = this.items[index];
    if (item === undefined) {
      throw new Error('掉落装备索引存在但实例缺失。');
    }
    this.items.splice(index, 1);
    try {
      this.rebuildRenderer();
    } catch (error: unknown) {
      this.items.splice(index, 0, item);
      throw error;
    }
    item.dispose();
    return true;
  }

  /**
   * 批量移除同一运行时所有权范围内的装备，只在完整移除后重建一次共享批次。
   *
   * 该入口用于 Chunk 离场，不要求装备已经落地，也不会改变宝箱会话中的剩余战利品。
   */
  public removeOwned(instanceIds: readonly number[]): void {
    if (this.disposed || instanceIds.length === 0) {
      return;
    }
    const ownedIds = new Set(instanceIds);
    const removed: Array<Readonly<{
      index: number;
      item: DroppedEquipmentRuntime;
    }>> = [];
    for (let index = this.items.length - 1; index >= 0; index--) {
      const item = this.items[index];
      if (item !== undefined && ownedIds.has(item.instanceId)) {
        removed.push(Object.freeze({ index, item }));
        this.items.splice(index, 1);
      }
    }
    if (removed.length === 0) {
      return;
    }
    try {
      this.rebuildRenderer();
    } catch (error: unknown) {
      for (let removedIndex = removed.length - 1; removedIndex >= 0; removedIndex--) {
        const entry = removed[removedIndex];
        if (entry !== undefined) {
          this.items.splice(entry.index, 0, entry.item);
        }
      }
      throw error;
    }
    for (const entry of removed) {
      entry.item.dispose();
    }
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
    this.renderer?.dispose();
    this.accentRenderer?.dispose();
    this.renderer = null;
    this.accentRenderer = null;
    this.material.destroy();
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('掉落装备群体已经释放。');
    }
  }

  /** 拾取或新增只在低频事件发生时重建固定索引，不把每件装备拆成 Renderer。 */
  private rebuildRenderer(): void {
    let nextRenderer: DroppedEquipmentRenderer | null = null;
    let nextAccentRenderer: DroppedEquipmentAccentRenderer | null = null;
    try {
      if (this.items.length > 0) {
        nextRenderer = new DroppedEquipmentRenderer(this.parent, this.items, this.material);
        nextAccentRenderer = new DroppedEquipmentAccentRenderer(
          this.parent,
          this.items,
          this.equipmentLibrary,
        );
      }
    } catch (error: unknown) {
      nextAccentRenderer?.dispose();
      nextRenderer?.dispose();
      throw error;
    }
    this.accentRenderer?.dispose();
    this.renderer?.dispose();
    this.renderer = nextRenderer;
    this.accentRenderer = nextAccentRenderer;
  }
}
