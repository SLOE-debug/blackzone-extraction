import { type Material, Node } from 'cc';
import {
  type EquipmentLibrary,
  EquipmentId,
} from '../../../../core/equipment/equipment';
import { type LootTable } from '../../../../core/loot/weighted-loot-table';
import { normalizeRandomSeed } from '../../../../core/math/xorshift32';
import {
  type MutableDroppedEquipmentInspection,
  DroppedEquipmentPopulation,
  DroppedEquipmentInstanceIdSequence,
} from '../../equipment/population/dropped-equipment-population';
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
  private readonly drops: DroppedEquipmentPopulation;
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
    parent: Node,
    surfaceMaterialTemplate: Material,
    sharedRenderer: TreasureChestSharedRenderer,
    private readonly spawn: Readonly<BattlefieldTreasureChestSpawn>,
    private readonly sessionState: BattlefieldTreasureChestSessionState,
    private readonly equipmentLibrary: EquipmentLibrary,
    private readonly lootTable: LootTable<EquipmentId>,
    instanceIds: DroppedEquipmentInstanceIdSequence,
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
      this.drops = new DroppedEquipmentPopulation(
        parent,
        surfaceMaterialTemplate,
        instanceIds,
      );
    } catch (error: unknown) {
      this.renderer.dispose();
      throw error;
    }
    try {
      this.restoreOpenedState();
    } catch (error: unknown) {
      this.drops.dispose();
      this.renderer.dispose();
      throw error;
    }
  }

  /** 只有尚未打开的宝箱能进入操作按钮候选。 */
  public get interactable(): boolean {
    return !this.disposed && this.phase === TreasureChestPhase.Closed;
  }

  /** 启动一次不可逆的丝滑开启动画。 */
  public open(): boolean {
    if (!this.interactable) {
      return false;
    }
    this.lootRandomState[0] = createLootRuntimeRandomSeed(this.spawn.seed ^ 0x9e3779b1);
    this.scatterRandomState[0] = createLootRuntimeRandomSeed(this.spawn.seed ^ 0x85ebca6b);
    const equipmentIds = this.rollLoot();
    this.sessionState.open(
      this.spawn.key,
      equipmentIds,
      this.scatterRandomState[0] ?? 1,
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

  /** 推进箱盖动画和已经释放的掉落装备。 */
  public update(deltaTime: number): void {
    if (this.disposed) {
      return;
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
    if (this.phase === TreasureChestPhase.Opening) {
      this.elapsed += safeDeltaTime;
      this.renderer.setLidAngleDegrees(evaluateTreasureChestLidAngle(this.elapsed));
      if (!this.lootReleased && this.elapsed >= TREASURE_CHEST_ANIMATION.lootReleaseTime) {
        this.releaseLoot();
      }
      if (this.elapsed >= TREASURE_CHEST_ANIMATION.duration) {
        this.phase = TreasureChestPhase.Open;
      }
    }
    this.drops.update(safeDeltaTime);
  }

  /** 把最近落地装备查询交给宝箱独占的掉落群体。 */
  public writeNearestEquipmentInspection(
    playerX: number,
    playerZ: number,
    result: MutableDroppedEquipmentInspection,
  ): boolean {
    return this.drops.writeNearestInspection(playerX, playerZ, result);
  }

  /** 查询本宝箱掉落群中的稳定装备实例。 */
  public getDroppedEquipmentId(instanceId: number): EquipmentId | null {
    return this.drops.getEquipmentId(instanceId);
  }

  /** 移除本宝箱掉落群中已经完成拾取的装备实例。 */
  public removeDroppedEquipment(instanceId: number): boolean {
    const equipmentId = this.drops.getEquipmentId(instanceId);
    if (equipmentId === null || !this.drops.remove(instanceId)) {
      return false;
    }
    this.sessionState.consumeLoot(this.spawn.key, equipmentId);
    return true;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.drops.dispose();
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
    this.releaseLoot();
  }

  /** 第一次开箱时确定并校验整组战利品，后续 Chunk 重载不再重新抽取。 */
  private rollLoot(): readonly EquipmentId[] {
    const equipmentIds = this.lootTable.roll(this.lootRandomState, 0);
    for (const equipmentId of equipmentIds) {
      this.equipmentLibrary.get(equipmentId);
    }
    return equipmentIds;
  }

  /** 使用会话中剩余的装备和首次开箱种子生成当前 Chunk 的掉落实例。 */
  private releaseLoot(): void {
    const equipmentIds = this.sessionState.getRemainingLoot(this.spawn.key);
    const scatterSeed = this.sessionState.getScatterSeed(this.spawn.key);
    if (equipmentIds === null || scatterSeed === null) {
      throw new Error(`已打开宝箱缺少会话战利品状态：${this.spawn.key}`);
    }
    if (equipmentIds.length === 0) {
      this.lootReleased = true;
      return;
    }
    this.scatterRandomState[0] = scatterSeed;
    const trajectories = createLootScatterTrajectories(
      equipmentIds.length,
      this.scatterRandomState,
      0,
      this.spawn.x,
      this.spawn.y + TREASURE_CHEST_LAYOUT.lootReleaseHeight,
      this.spawn.z,
    );
    this.drops.spawnBurst(equipmentIds, trajectories);
    this.lootReleased = true;
  }
}
