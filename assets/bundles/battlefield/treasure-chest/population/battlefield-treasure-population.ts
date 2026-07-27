import { Node } from 'cc';
import { type Disposable } from '../../../../core/contracts/disposable';
import { EquipmentId } from '../../equipment/catalog/equipment-id';
import { type BattlefieldEquipmentLibrary } from '../../equipment/catalog/battlefield-equipment-contracts';
import { type LootTable } from '../../../../core/loot/weighted-loot-table';
import {
  type ChunkRuntimeParticipant,
  type ChunkRuntimeScope,
} from '../../../../core/world/chunk-runtime-registry';
import {
  DroppedEquipmentPopulation,
  DroppedEquipmentWorldRuntimeIdSequence,
  type BattlefieldPlayerDiscardRequest,
  type MutableDroppedEquipmentInspection,
} from '../../equipment/population/dropped-equipment-population';
import { BattlefieldItemInstanceSeedSequence } from '../../equipment/model/battlefield-item-instance';
import { BattlefieldEnvironmentPopulation } from '../../environment/population/battlefield-environment-population';
import {
  BattlefieldInteractionAction,
  type BattlefieldInteractionProvider,
  type MutableBattlefieldInteractionCandidate,
} from '../../interaction/model/battlefield-interaction';
import { BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG } from '../../environment/model/battlefield-environment-config';
import { BATTLEFIELD_TREASURE_MAXIMUM_LOOT_COUNT } from '../../loot/model/battlefield-treasure-loot-table';
import {
  BATTLEFIELD_MAXIMUM_PLAYER_DISCARDED_EQUIPMENT,
  calculateDroppedEquipmentCapacity,
} from '../../equipment/model/dropped-equipment-capacity';
import {
  BATTLEFIELD_TREASURE_CHEST_GENERATION,
  createBattlefieldTreasureChestSpawns,
} from '../model/battlefield-treasure-chest-spawn';
import { BATTLEFIELD_TREASURE_CHEST_ENVIRONMENT_BLOCKERS } from '../model/battlefield-treasure-chest-environment';
import { BattlefieldTreasureChestSessionState } from '../model/battlefield-treasure-chest-session-state';
import { TREASURE_CHEST_LAYOUT } from '../model/treasure-chest-layout';
import { TreasureChestSharedRenderer } from '../rendering/treasure-chest-shared-renderer';
import { TreasureChestRuntime } from './treasure-chest-runtime';
import { type BattlefieldTreasurePerformanceRecorder } from '../../debug/battlefield-treasure-performance';

/** 聚合活动 Chunk 的宝箱、开启动画、交互和落地装备查询。 */
export class BattlefieldTreasurePopulation
implements ChunkRuntimeParticipant<BattlefieldEnvironmentPopulation>,
BattlefieldInteractionProvider, Disposable {
  private readonly chests: TreasureChestRuntime[] = [];
  private readonly equipmentWorldRuntimeIds = new DroppedEquipmentWorldRuntimeIdSequence();
  private readonly itemInstanceSeeds = new BattlefieldItemInstanceSeedSequence();
  private readonly sessionState = new BattlefieldTreasureChestSessionState();
  private readonly renderer: TreasureChestSharedRenderer;
  private readonly droppedEquipment: DroppedEquipmentPopulation;
  private nextTreasureChestId = 1;
  private disposed = false;

  /** 当前活动 Chunk 中的宝箱数量。 */
  public get activeChestCount(): number {
    return this.chests.length;
  }

  /** 当前活动窗口内已经开始开启流程的宝箱数量。 */
  public get openedChestCount(): number {
    let count = 0;
    for (const chest of this.chests) {
      if (chest.opened) {
        count++;
      }
    }
    return count;
  }

  /** 宝箱掉落与玩家丢弃装备的当前世界实例总数。 */
  public get droppedEquipmentCount(): number {
    return this.droppedEquipment.count;
  }

  /** 当前掉落物本体与毛笔形信标实际占用的渲染批次数量。 */
  public get droppedRenderBatchCount(): number {
    return this.droppedEquipment.renderBatchCount;
  }

  constructor(
    parent: Node,
    private readonly equipmentLibrary: BattlefieldEquipmentLibrary,
    private readonly lootTable: LootTable<EquipmentId>,
    private readonly performance: BattlefieldTreasurePerformanceRecorder,
  ) {
    this.renderer = new TreasureChestSharedRenderer(parent);
    try {
      this.droppedEquipment = new DroppedEquipmentPopulation(
        parent,
        this.equipmentWorldRuntimeIds,
        equipmentLibrary,
        performance,
        calculateDroppedEquipmentCapacity(
          BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.activeChunkRadius,
          BATTLEFIELD_TREASURE_CHEST_GENERATION.maximumChestsPerGeneratedChunk,
          BATTLEFIELD_TREASURE_MAXIMUM_LOOT_COUNT,
          BATTLEFIELD_MAXIMUM_PLAYER_DISCARDED_EQUIPMENT,
        ),
      );
    } catch (error: unknown) {
      this.renderer.dispose();
      throw error;
    }
  }

  /** 为当前 Chunk 程序化生成宝箱，并把各自运行时登记到作用域。 */
  public populate(
    scope: ChunkRuntimeScope,
    environment: BattlefieldEnvironmentPopulation,
  ): void {
    this.ensureActive();
    const placementConstraint = Object.freeze({
      isAreaClear: (x: number, z: number, clearanceRadius: number): boolean => (
        environment.isAreaClearOf(
          BATTLEFIELD_TREASURE_CHEST_ENVIRONMENT_BLOCKERS,
          x,
          z,
          clearanceRadius,
        )
      ),
    });
    for (const spawn of createBattlefieldTreasureChestSpawns(
      scope.chunk,
      placementConstraint,
    )) {
      const chest = new TreasureChestRuntime(
        this.nextTreasureChestId++,
        this.renderer,
        spawn,
        this.sessionState,
        this.equipmentLibrary,
        this.lootTable,
        this.droppedEquipment,
        this.itemInstanceSeeds,
        this.performance,
      );
      this.chests.push(chest);
      scope.own(new TreasureChestOwnership(this.chests, chest));
    }
  }

  /** 推进全部宝箱、掉落物和共享渲染，并返回本帧首次释放的掉落物数量。 */
  public update(deltaTime: number): number {
    if (this.disposed) {
      return 0;
    }
    let releasedLootCount = 0;
    for (const chest of this.chests) {
      releasedLootCount += chest.update(deltaTime);
    }
    this.droppedEquipment.update(deltaTime);
    this.renderer.synchronize();
    return releasedLootCount;
  }

  /** 场景激活前提交加载阶段已经登记的全部初始宝箱。 */
  public completeInitialRendering(): void {
    this.ensureActive();
    this.droppedEquipment.prewarm();
    this.renderer.synchronize();
  }

  /** 把玩家最新位置同步给全部活动宝箱的低频信标提示。 */
  public synchronizeAttention(playerX: number, playerZ: number): void {
    if (this.disposed) {
      return;
    }
    for (const chest of this.chests) {
      chest.synchronizeAttentionTarget(playerX, playerZ);
    }
  }

  /** 查找交互半径内最近的未开启宝箱。 */
  public writeNearestInteraction(
    playerX: number,
    playerZ: number,
    result: MutableBattlefieldInteractionCandidate,
  ): boolean {
    if (this.disposed) {
      return false;
    }
    const maximumDistanceSquared = TREASURE_CHEST_LAYOUT.interactionRadius
      * TREASURE_CHEST_LAYOUT.interactionRadius;
    let bestDistanceSquared = maximumDistanceSquared;
    let best: TreasureChestRuntime | null = null;
    for (const chest of this.chests) {
      if (!chest.interactable) {
        continue;
      }
      const deltaX = chest.x - playerX;
      const deltaZ = chest.z - playerZ;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSquared <= bestDistanceSquared) {
        bestDistanceSquared = distanceSquared;
        best = chest;
      }
    }
    if (best === null) {
      return false;
    }
    result.sourceId = best.id;
    result.action = BattlefieldInteractionAction.OpenContainer;
    result.x = best.x;
    result.z = best.z;
    result.distanceSquared = bestDistanceSquared;
    return true;
  }

  /** 打开仍处于活动 Chunk 且标识匹配的宝箱。 */
  public activateInteraction(
    sourceId: number,
    action: BattlefieldInteractionAction,
  ): boolean {
    if (this.disposed || action !== BattlefieldInteractionAction.OpenContainer) {
      return false;
    }
    for (const chest of this.chests) {
      if (chest.id === sourceId) {
        return chest.open();
      }
    }
    return false;
  }

  /** 在宝箱掉落与玩家替换掉落中选择离玩家最近的装备。 */
  public writeNearestEquipmentInspection(
    playerX: number,
    playerZ: number,
    result: MutableDroppedEquipmentInspection,
  ): boolean {
    if (this.disposed) {
      return false;
    }
    return this.droppedEquipment.writeNearestInspection(playerX, playerZ, result);
  }

  /** 在宝箱掉落与玩家替换掉落中查找指定装备实例。 */
  public getDroppedEquipment(
    worldRuntimeId: number,
  ): ReturnType<DroppedEquipmentPopulation['getItem']> {
    if (this.disposed) {
      return null;
    }
    return this.droppedEquipment.getItem(worldRuntimeId);
  }

  /** 在提取背包物品前检查玩家丢弃预留池容量。 */
  public canSpawnPlayerDiscard(): boolean {
    return !this.disposed && this.droppedEquipment.canSpawnPlayerDiscard();
  }

  /** 生成不归属任何 Chunk 宝箱的玩家丢弃物。 */
  public trySpawnPlayerDiscard(request: Readonly<BattlefieldPlayerDiscardRequest>): boolean {
    return !this.disposed && this.droppedEquipment.trySpawnPlayerDiscard(request);
  }

  /** 从拥有指定实例的掉落群体中移除已经完成拾取的装备。 */
  public removeDroppedEquipment(worldRuntimeId: number): boolean {
    if (this.disposed) {
      return false;
    }
    for (const chest of this.chests) {
      if (chest.ownsDroppedEquipment(worldRuntimeId)) {
        return chest.removeDroppedEquipment(worldRuntimeId);
      }
    }
    return this.droppedEquipment.remove(worldRuntimeId);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.droppedEquipment.dispose();
    while (this.chests.length > 0) {
      this.chests.pop()?.dispose();
    }
    this.renderer.dispose();
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('战场宝箱群体已经释放。');
    }
  }
}

/** 在 Chunk 卸载时释放宝箱及其尚在飞行或已经落地的全部装备。 */
class TreasureChestOwnership implements Disposable {
  private disposed = false;

  constructor(
    private readonly chests: TreasureChestRuntime[],
    private readonly chest: TreasureChestRuntime,
  ) {}

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    const index = this.chests.indexOf(this.chest);
    if (index >= 0) {
      this.chests.splice(index, 1);
    }
    this.chest.dispose();
  }
}
