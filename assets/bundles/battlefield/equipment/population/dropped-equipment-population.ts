import { type Material, Node } from 'cc';
import { type LootScatterTrajectory } from '../../loot/model/loot-scatter-trajectory';
import { type BattlefieldEquipmentLibrary } from '../catalog/battlefield-equipment-contracts';
import { EquipmentId } from '../catalog/equipment-id';
import {
  type BattlefieldItemInstance,
  validateBattlefieldItemInstanceSeed,
} from '../model/battlefield-item-instance';
import {
  createPlayerDiscardTrajectory,
  type PlayerDiscardTrajectoryRequest,
} from '../model/player-discard-trajectory';
import { createDroppedEquipmentMaterial } from '../rendering/dropped-equipment-material';
import { DroppedEquipmentAccentRenderer } from '../rendering/dropped-equipment-accent-renderer';
import { DroppedEquipmentRenderer } from '../rendering/dropped-equipment-renderer';
import { DroppedEquipmentRuntime } from './dropped-equipment-runtime';
import { type BattlefieldTreasurePerformanceRecorder } from '../../debug/battlefield-treasure-performance';
import { DroppedEquipmentRenderSchedule } from './dropped-equipment-render-schedule';

const EQUIPMENT_INSPECTION_RADIUS = 3.5;

/** HUD 复用的最近落地装备结果。 */
export interface MutableDroppedEquipmentInspection {
  worldRuntimeId: number;
  itemInstanceSeed: number;
  equipmentId: EquipmentId;
  x: number;
  y: number;
  z: number;
}

/** 为同一战场中的全部掉落装备分配不会跨宝箱冲突的运行时标识。 */
export class DroppedEquipmentWorldRuntimeIdSequence {
  private nextWorldRuntimeId = 1;

  public allocate(): number {
    if (!Number.isSafeInteger(this.nextWorldRuntimeId)) {
      throw new Error('战场掉落装备实例标识已经耗尽。');
    }
    return this.nextWorldRuntimeId++;
  }
}

/** 玩家丢弃一件背包装备时提交给固定掉落池的完整请求。 */
export interface BattlefieldPlayerDiscardRequest extends PlayerDiscardTrajectoryRequest {
  readonly equipmentId: EquipmentId;
  readonly stackCount: number;
}

/** 管理固定容量掉落槽位、预热批次、动画和近距离查询。 */
export class DroppedEquipmentPopulation {
  private readonly material: Material;
  private readonly items: Array<DroppedEquipmentRuntime | null>;
  private itemCount = 0;
  private renderer: DroppedEquipmentRenderer | null = null;
  private accentRenderer: DroppedEquipmentAccentRenderer | null = null;
  private readonly renderSchedule = new DroppedEquipmentRenderSchedule();
  private prewarmActive = false;
  private prewarmFramesRemaining = 0;
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
    private readonly worldRuntimeIds: DroppedEquipmentWorldRuntimeIdSequence,
    private readonly equipmentLibrary: BattlefieldEquipmentLibrary,
    private readonly performance: BattlefieldTreasurePerformanceRecorder,
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
        this.performance,
      );
      accentRenderer = new DroppedEquipmentAccentRenderer(
        this.parent,
        this.items,
        this.equipmentLibrary,
        this.performance,
      );
      renderer.prewarm();
      accentRenderer.prewarm();
    } catch (error: unknown) {
      accentRenderer?.dispose();
      renderer?.dispose();
      throw error;
    }
    this.renderer = renderer;
    this.accentRenderer = accentRenderer;
    this.prewarmActive = true;
    this.prewarmFramesRemaining = 1;
  }

  /** 按一一对应的装备标识和轨迹占用连续空闲槽位。 */
  public spawnBurst(
    itemInstances: readonly Readonly<BattlefieldItemInstance>[],
    trajectories: readonly Readonly<LootScatterTrajectory>[],
  ): readonly number[] {
    this.ensureActive();
    this.ensurePrewarmed();
    if (itemInstances.length !== trajectories.length) {
      throw new Error('掉落装备数量必须与爆散轨迹数量一致。');
    }
    if (this.itemCount + itemInstances.length > this.items.length) {
      throw new Error('活动 Chunk 的掉落装备数量超过预热固定容量。');
    }
    const firstSlot = this.itemCount;
    const spawnedWorldRuntimeIds: number[] = [];
    try {
      for (let index = 0; index < itemInstances.length; index++) {
        const itemInstance = itemInstances[index];
        const trajectory = trajectories[index];
        if (itemInstance === undefined || trajectory === undefined) {
          throw new Error('掉落装备或爆散轨迹索引不存在。');
        }
        const worldRuntimeId = this.worldRuntimeIds.allocate();
        this.items[this.itemCount++] = new DroppedEquipmentRuntime(
          worldRuntimeId,
          itemInstance.itemInstanceSeed,
          itemInstance.equipmentId,
          trajectory,
        );
        spawnedWorldRuntimeIds.push(worldRuntimeId);
      }
      this.renderSchedule.markDirty();
      return Object.freeze(spawnedWorldRuntimeIds);
    } catch (error: unknown) {
      while (this.itemCount > firstSlot) {
        const slot = --this.itemCount;
        this.items[slot]?.dispose();
        this.items[slot] = null;
      }
      this.renderSchedule.markDirty();
      throw error;
    }
  }

  /** 当前固定池是否能原子接纳一件玩家丢弃物。 */
  public canSpawnPlayerDiscard(): boolean {
    return !this.disposed && this.itemCount < this.items.length;
  }

  /** 容量充足时创建新世界身份，并保留装备自身的永久实例种子。 */
  public trySpawnPlayerDiscard(request: Readonly<BattlefieldPlayerDiscardRequest>): boolean {
    this.ensureActive();
    this.ensurePrewarmed();
    validateBattlefieldItemInstanceSeed(request.itemInstanceSeed);
    if (!Number.isSafeInteger(request.stackCount) || request.stackCount !== 1) {
      throw new Error('当前玩家丢弃只接受一件不可堆叠装备。');
    }
    if (!this.canSpawnPlayerDiscard()) {
      return false;
    }
    const worldRuntimeId = this.worldRuntimeIds.allocate();
    this.items[this.itemCount++] = new DroppedEquipmentRuntime(
      worldRuntimeId,
      request.itemInstanceSeed,
      request.equipmentId,
      createPlayerDiscardTrajectory(request),
    );
    this.renderSchedule.markDirty();
    return true;
  }

  public update(deltaTime: number): void {
    if (this.disposed) {
      return;
    }
    if (this.prewarmActive && this.prewarmFramesRemaining > 0) {
      this.prewarmFramesRemaining--;
      return;
    }
    if (this.prewarmActive) {
      this.renderer?.finishPrewarm();
      this.accentRenderer?.finishPrewarm();
      this.prewarmActive = false;
    }
    let hasMovingItems = false;
    for (let index = 0; index < this.itemCount; index++) {
      const item = this.requireItem(index);
      hasMovingItems ||= item.moving;
      item.update(deltaTime);
    }
    if (this.renderSchedule.consumeFlushRequest(hasMovingItems)) {
      this.flushRendering();
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
    result.worldRuntimeId = best.worldRuntimeId;
    result.itemInstanceSeed = best.itemInstanceSeed;
    result.x = best.x;
    result.y = best.y + 0.72;
    result.z = best.z;
    return true;
  }

  public getItem(worldRuntimeId: number): Readonly<BattlefieldItemInstance> | null {
    const index = this.findLandedIndex(worldRuntimeId);
    if (index < 0) {
      return null;
    }
    const item = this.requireItem(index);
    return Object.freeze({
      equipmentId: item.equipmentId,
      itemInstanceSeed: item.itemInstanceSeed,
    });
  }

  /** 用末尾活动槽位回填空洞，避免索引流重排或渲染器重建。 */
  public remove(worldRuntimeId: number): boolean {
    if (this.disposed) {
      return false;
    }
    const index = this.findLandedIndex(worldRuntimeId);
    if (index < 0) {
      return false;
    }
    this.removeAt(index);
    this.renderSchedule.markDirty();
    return true;
  }

  /** Chunk 离场时批量释放所有权范围内的掉落，并只同步一次活动前缀。 */
  public removeOwned(worldRuntimeIds: readonly number[]): void {
    if (this.disposed || worldRuntimeIds.length === 0) {
      return;
    }
    const ownedIds = new Set(worldRuntimeIds);
    let removed = false;
    for (let index = this.itemCount - 1; index >= 0; index--) {
      if (ownedIds.has(this.requireItem(index).worldRuntimeId)) {
        this.removeAt(index);
        removed = true;
      }
    }
    if (removed) {
      this.renderSchedule.markDirty();
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

  private findLandedIndex(worldRuntimeId: number): number {
    if (this.disposed) {
      return -1;
    }
    for (let index = 0; index < this.itemCount; index++) {
      const item = this.requireItem(index);
      if (item.worldRuntimeId === worldRuntimeId && item.landed) {
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

  /** 在统一更新末尾最多刷新一次两个掉落批次。 */
  private flushRendering(): void {
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
