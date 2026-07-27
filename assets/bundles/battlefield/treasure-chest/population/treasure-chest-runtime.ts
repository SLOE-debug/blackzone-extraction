import { type LootTable } from '../../../../core/loot/weighted-loot-table';
import { normalizeRandomSeed } from '../../../../core/math/xorshift32';
import { DroppedEquipmentPopulation } from '../../equipment/population/dropped-equipment-population';
import { type BattlefieldEquipmentLibrary } from '../../equipment/catalog/battlefield-equipment-contracts';
import { EquipmentId } from '../../equipment/catalog/equipment-id';
import {
  type BattlefieldItemInstance,
  BattlefieldItemInstanceSeedSequence,
} from '../../equipment/model/battlefield-item-instance';
import { createLootRuntimeRandomSeed } from '../../loot/model/loot-scatter-random-seed';
import { createLootScatterTrajectories } from '../../loot/model/loot-scatter-trajectory';
import {
  evaluateTreasureChestLidAngle,
  TREASURE_CHEST_ANIMATION,
} from '../animation/treasure-chest-animation';
import { TREASURE_CHEST_ATTENTION } from '../animation/treasure-chest-attention';
import {
  type BattlefieldTreasureChestSpawn,
} from '../model/battlefield-treasure-chest-spawn';
import { BattlefieldTreasureChestSessionState } from '../model/battlefield-treasure-chest-session-state';
import { TREASURE_CHEST_LAYOUT } from '../model/treasure-chest-layout';
import {
  type TreasureChestRenderHandle,
  TreasureChestSharedRenderer,
} from '../rendering/treasure-chest-shared-renderer';
import {
  BattlefieldTreasurePerformanceSection,
  type BattlefieldTreasurePerformanceRecorder,
} from '../../debug/battlefield-treasure-performance';

enum TreasureChestPhase {
  Closed,
  Opening,
  Open,
}

/** 单个宝箱的交互、开启动画、战利品抽取和掉落物生命周期。 */
export class TreasureChestRuntime {
  public readonly id: number;
  public readonly x: number;
  public readonly z: number;
  private readonly renderer: TreasureChestRenderHandle;
  private readonly dropInstanceIds: number[] = [];
  private readonly lootRandomState = new Uint32Array(1);
  private readonly scatterRandomState = new Uint32Array(1);
  private phase = TreasureChestPhase.Closed;
  private elapsed = 0;
  private attentionElapsed = 0;
  private playerDistanceSquared = TREASURE_CHEST_ATTENTION.awarenessRadius
    * TREASURE_CHEST_ATTENTION.awarenessRadius;
  private lootReleased = false;
  private disposed = false;

  constructor(
    id: number,
    sharedRenderer: TreasureChestSharedRenderer,
    private readonly spawn: Readonly<BattlefieldTreasureChestSpawn>,
    private readonly sessionState: BattlefieldTreasureChestSessionState,
    private readonly equipmentLibrary: BattlefieldEquipmentLibrary,
    private readonly lootTable: LootTable<EquipmentId>,
    private readonly drops: DroppedEquipmentPopulation,
    private readonly itemInstanceSeeds: BattlefieldItemInstanceSeedSequence,
    private readonly performance: BattlefieldTreasurePerformanceRecorder,
  ) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error('宝箱运行时标识必须是正安全整数。');
    }
    this.id = id;
    this.x = spawn.x;
    this.z = spawn.z;
    this.lootRandomState[0] = normalizeRandomSeed(spawn.seed);
    this.scatterRandomState[0] = normalizeRandomSeed(spawn.seed);
    this.renderer = sharedRenderer.register(spawn);
    try {
      this.restoreOpenedState();
    } catch (error: unknown) {
      this.drops.removeOwned(this.dropInstanceIds);
      this.dropInstanceIds.length = 0;
      this.renderer.dispose();
      throw error;
    }
  }

  /** 只有尚未打开的宝箱能进入场景操作候选。 */
  public get interactable(): boolean {
    return !this.disposed && this.phase === TreasureChestPhase.Closed;
  }

  /** 宝箱是否已经开始不可逆的开启流程。 */
  public get opened(): boolean {
    return this.phase !== TreasureChestPhase.Closed;
  }

  /** 当前仍属于本宝箱的世界掉落物数量。 */
  public get droppedEquipmentCount(): number {
    return this.dropInstanceIds.length;
  }

  /** 启动一次不可逆的丝滑开启动画。 */
  public open(): boolean {
    if (!this.interactable) {
      return false;
    }
    this.lootRandomState[0] = createLootRuntimeRandomSeed(this.spawn.seed ^ 0x9e3779b1);
    this.scatterRandomState[0] = createLootRuntimeRandomSeed(this.spawn.seed ^ 0x85ebca6b);
    let startedAt = this.performance.beginTreasureSection();
    const itemInstances = this.rollLoot();
    this.performance.endTreasureSection(
      BattlefieldTreasurePerformanceSection.TreasureOpenRollLoot,
      startedAt,
      0,
      0,
      this.drops.count,
    );
    startedAt = this.performance.beginTreasureSection();
    this.sessionState.open(
      this.spawn.key,
      itemInstances,
      this.scatterRandomState[0] ?? 1,
    );
    this.performance.endTreasureSection(
      BattlefieldTreasurePerformanceSection.TreasureSessionWrite,
      startedAt,
      0,
      0,
      this.drops.count,
    );
    this.phase = TreasureChestPhase.Opening;
    this.elapsed = 0;
    return true;
  }

  /** 缓存玩家到宝箱的距离，供下一次固定频率信标提示求值。 */
  public synchronizeAttentionTarget(playerX: number, playerZ: number): void {
    if (this.disposed) {
      return;
    }
    const deltaX = playerX - this.x;
    const deltaZ = playerZ - this.z;
    this.playerDistanceSquared = deltaX * deltaX + deltaZ * deltaZ;
  }

  /** 推进箱盖动画和掉落装备，并返回本帧首次释放的掉落物数量。 */
  public update(deltaTime: number): number {
    if (this.disposed) {
      return 0;
    }
    if (!Number.isFinite(deltaTime)) {
      throw new Error('宝箱帧时间必须是有限数值。');
    }
    const safeDeltaTime = Math.max(0, Math.min(deltaTime, 0.05));
    this.attentionElapsed += safeDeltaTime;
    this.renderer.updateAttention(
      this.attentionElapsed,
      this.playerDistanceSquared,
      this.phase === TreasureChestPhase.Closed,
    );
    let releasedLootCount = 0;
    if (this.phase === TreasureChestPhase.Opening) {
      this.elapsed += safeDeltaTime;
      this.renderer.setLidAngleDegrees(evaluateTreasureChestLidAngle(this.elapsed));
      if (!this.lootReleased && this.elapsed >= TREASURE_CHEST_ANIMATION.lootReleaseTime) {
        releasedLootCount = this.releaseLoot();
      }
      if (this.elapsed >= TREASURE_CHEST_ANIMATION.duration) {
        this.phase = TreasureChestPhase.Open;
      }
    }
    return releasedLootCount;
  }

  /** 判断一个全局掉落实例当前是否由本宝箱拥有。 */
  public ownsDroppedEquipment(worldRuntimeId: number): boolean {
    return this.dropInstanceIds.includes(worldRuntimeId);
  }

  /** 移除本宝箱掉落群中已经完成拾取的装备实例。 */
  public removeDroppedEquipment(worldRuntimeId: number): boolean {
    const ownedIndex = this.dropInstanceIds.indexOf(worldRuntimeId);
    if (ownedIndex < 0) {
      return false;
    }
    const item = this.drops.getItem(worldRuntimeId);
    if (item === null || !this.drops.remove(worldRuntimeId)) {
      return false;
    }
    this.dropInstanceIds.splice(ownedIndex, 1);
    this.sessionState.consumeLoot(this.spawn.key, item.itemInstanceSeed);
    return true;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.drops.removeOwned(this.dropInstanceIds);
    this.dropInstanceIds.length = 0;
    this.renderer.dispose();
  }

  /** 恢复已打开宝箱的最终箱盖姿态和会话中仍未拾取的装备。 */
  private restoreOpenedState(): void {
    if (!this.sessionState.isOpened(this.spawn.key)) {
      return;
    }
    this.phase = TreasureChestPhase.Open;
    this.elapsed = TREASURE_CHEST_ANIMATION.duration;
    this.renderer.setLidAngleDegrees(TREASURE_CHEST_ANIMATION.finalAngleDegrees);
    this.renderer.updateAttention(0, this.playerDistanceSquared, false);
    void this.releaseLoot();
  }

  /** 第一次开箱时确定并校验整组战利品，后续 Chunk 重载不再重新抽取。 */
  private rollLoot(): readonly Readonly<BattlefieldItemInstance>[] {
    const equipmentIds = this.lootTable.roll(this.lootRandomState, 0);
    const itemInstances: Readonly<BattlefieldItemInstance>[] = [];
    for (const equipmentId of equipmentIds) {
      this.equipmentLibrary.get(equipmentId);
      itemInstances.push(Object.freeze({
        equipmentId,
        itemInstanceSeed: this.itemInstanceSeeds.allocate(),
      }));
    }
    return Object.freeze(itemInstances);
  }

  /** 使用会话中剩余的装备和首次开箱种子生成当前 Chunk 的掉落实例。 */
  private releaseLoot(): number {
    const itemInstances = this.sessionState.getRemainingLoot(this.spawn.key);
    const scatterSeed = this.sessionState.getScatterSeed(this.spawn.key);
    if (itemInstances === null || scatterSeed === null) {
      throw new Error(`已打开宝箱缺少会话战利品状态：${this.spawn.key}`);
    }
    if (itemInstances.length === 0) {
      this.lootReleased = true;
      return 0;
    }
    this.scatterRandomState[0] = scatterSeed;
    let startedAt = this.performance.beginTreasureSection();
    const trajectories = createLootScatterTrajectories(
      itemInstances.length,
      this.scatterRandomState,
      0,
      this.spawn.x,
      this.spawn.y + TREASURE_CHEST_LAYOUT.lootReleaseHeight,
      this.spawn.z,
    );
    this.performance.endTreasureSection(
      BattlefieldTreasurePerformanceSection.TreasureScatterBuild,
      startedAt,
      0,
      0,
      this.drops.count,
    );
    startedAt = this.performance.beginTreasureSection();
    const worldRuntimeIds = this.drops.spawnBurst(itemInstances, trajectories);
    this.performance.endTreasureSection(
      BattlefieldTreasurePerformanceSection.TreasureDropSpawn,
      startedAt,
      0,
      0,
      this.drops.count,
    );
    this.dropInstanceIds.push(...worldRuntimeIds);
    this.lootReleased = true;
    return itemInstances.length;
  }
}
