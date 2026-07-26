import { type Material, Node } from 'cc';
import { type LootScatterTrajectory } from '../../loot/model/loot-scatter-trajectory';
import { type BattlefieldEquipmentLibrary } from '../catalog/battlefield-equipment-contracts';
import { EquipmentId } from '../catalog/equipment-id';
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

/** 管理固定容量掉落槽位、预热批次、动画和近距离查询。 */
export class DroppedEquipmentPopulation {
  private readonly material: Material;
  private readonly items: Array<DroppedEquipmentRuntime | null>;
  private itemCount = 0;
  private renderer: DroppedEquipmentRenderer | null = null;
  private accentRenderer: DroppedEquipmentAccentRenderer | null = null;
  private disposed = false;

  public get count(): number {
    return this.itemCount;
  }

  public get capacity(): number {
    return this.items.length;
  }

  /** 预热完成后本体和信标固定占用两个批次，与活动物品数无关。 */
  public get renderBatchCount(): number {
    return (this.renderer === null ? 0 : 1) + (this.accentRenderer === null ? 0 : 1);
  }

  constructor(
    private readonly parent: Node,
    private readonly instanceIds: DroppedEquipmentInstanceIdSequence,
    private readonly equipmentLibrary: BattlefieldEquipmentLibrary,
    capacity: number,
  ) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('掉落装备固定容量必须是正整数。');
    }
    this.items = Array.from({ length: capacity }, () => null);
    this.material = createDroppedEquipmentMaterial();
  }

  /** 加载阶段一次性创建 Mesh、Material、Renderer 与最大容量 GPU 缓冲。 */
  public prewarm(): void {
    this.ensureActive();
    if (this.renderer !== null || this.accentRenderer !== null) {
      return;
    }
    let renderer: DroppedEquipmentRenderer | null = null;
    let accentRenderer: DroppedEquipmentAccentRenderer | null = null;
    try {
      renderer = new DroppedEquipmentRenderer(
        this.parent,
        this.items,
        EquipmentId.Sledgehammer,
        this.material,
      );
      accentRenderer = new DroppedEquipmentAccentRenderer(
        this.parent,
        this.items,
        this.equipmentLibrary,
      );
    } catch (error: unknown) {
      accentRenderer?.dispose();
      renderer?.dispose();
      throw error;
    }
    this.renderer = renderer;
    this.accentRenderer = accentRenderer;
  }

  /** 按一一对应的装备标识和轨迹占用连续空闲槽位。 */
  public spawnBurst(
    equipmentIds: readonly EquipmentId[],
    trajectories: readonly Readonly<LootScatterTrajectory>[],
  ): readonly number[] {
    this.ensureActive();
    this.ensurePrewarmed();
    if (equipmentIds.length !== trajectories.length) {
      throw new Error('掉落装备数量必须与爆散轨迹数量一致。');
    }
    if (this.itemCount + equipmentIds.length > this.items.length) {
      throw new Error('活动 Chunk 的掉落装备数量超过预热固定容量。');
    }
    const firstSlot = this.itemCount;
    const instanceIds: number[] = [];
    try {
      for (let index = 0; index < equipmentIds.length; index++) {
        const equipmentId = equipmentIds[index];
        const trajectory = trajectories[index];
        if (equipmentId === undefined || trajectory === undefined) {
          throw new Error('掉落装备或爆散轨迹索引不存在。');
        }
        const instanceId = this.instanceIds.allocate();
        this.items[this.itemCount++] = new DroppedEquipmentRuntime(
          instanceId,
          equipmentId,
          trajectory,
        );
        instanceIds.push(instanceId);
      }
      this.synchronizeRendering();
      return Object.freeze(instanceIds);
    } catch (error: unknown) {
      while (this.itemCount > firstSlot) {
        const slot = --this.itemCount;
        this.items[slot]?.dispose();
        this.items[slot] = null;
      }
      this.synchronizeRendering();
      throw error;
    }
  }

  public update(deltaTime: number): void {
    if (this.disposed) {
      return;
    }
    for (let index = 0; index < this.itemCount; index++) {
      this.requireItem(index).update(deltaTime);
    }
    this.synchronizeRendering();
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
    for (let index = 0; index < this.itemCount; index++) {
      const item = this.requireItem(index);
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

  public getEquipmentId(instanceId: number): EquipmentId | null {
    const index = this.findLandedIndex(instanceId);
    return index < 0 ? null : this.requireItem(index).equipmentId;
  }

  /** 用末尾活动槽位回填空洞，避免索引流重排或渲染器重建。 */
  public remove(instanceId: number): boolean {
    if (this.disposed) {
      return false;
    }
    const index = this.findLandedIndex(instanceId);
    if (index < 0) {
      return false;
    }
    this.removeAt(index);
    this.synchronizeRendering();
    return true;
  }

  /** Chunk 离场时批量释放所有权范围内的掉落，并只同步一次活动前缀。 */
  public removeOwned(instanceIds: readonly number[]): void {
    if (this.disposed || instanceIds.length === 0) {
      return;
    }
    const ownedIds = new Set(instanceIds);
    let removed = false;
    for (let index = this.itemCount - 1; index >= 0; index--) {
      if (ownedIds.has(this.requireItem(index).instanceId)) {
        this.removeAt(index);
        removed = true;
      }
    }
    if (removed) {
      this.synchronizeRendering();
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (let index = 0; index < this.itemCount; index++) {
      this.items[index]?.dispose();
      this.items[index] = null;
    }
    this.itemCount = 0;
    this.renderer?.dispose();
    this.accentRenderer?.dispose();
    this.renderer = null;
    this.accentRenderer = null;
    this.material.destroy();
  }

  private findLandedIndex(instanceId: number): number {
    if (this.disposed) {
      return -1;
    }
    for (let index = 0; index < this.itemCount; index++) {
      const item = this.requireItem(index);
      if (item.instanceId === instanceId && item.landed) {
        return index;
      }
    }
    return -1;
  }

  private removeAt(index: number): void {
    const removed = this.requireItem(index);
    const lastIndex = this.itemCount - 1;
    if (index !== lastIndex) {
      this.items[index] = this.requireItem(lastIndex);
    }
    this.items[lastIndex] = null;
    this.itemCount = lastIndex;
    removed.dispose();
  }

  private requireItem(index: number): DroppedEquipmentRuntime {
    const item = this.items[index];
    if (item === null || item === undefined) {
      throw new Error('掉落装备活动前缀存在空槽位。');
    }
    return item;
  }

  private synchronizeRendering(): void {
    this.renderer?.synchronize(this.itemCount);
    this.accentRenderer?.synchronize(this.itemCount);
  }

  private ensurePrewarmed(): void {
    if (this.renderer === null || this.accentRenderer === null) {
      throw new Error('掉落装备批次必须在场景加载阶段完成预热。');
    }
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('掉落装备群体已经释放。');
    }
  }
}
