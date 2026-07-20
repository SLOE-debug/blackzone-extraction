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
import { createLootScatterTrajectories } from '../../loot/model/loot-scatter-trajectory';
import {
  evaluateTreasureChestLidAngle,
  TREASURE_CHEST_ANIMATION,
} from '../animation/treasure-chest-animation';
import { TREASURE_CHEST_ATTENTION } from '../animation/treasure-chest-attention';
import {
  type BattlefieldTreasureChestSpawn,
  type TreasureChestId,
} from '../model/battlefield-treasure-chest-spawn';
import { TREASURE_CHEST_LAYOUT } from '../model/treasure-chest-layout';
import { TreasureChestRenderer } from '../rendering/treasure-chest-renderer';

enum TreasureChestPhase {
  Closed,
  Opening,
  Open,
}

/** 单个宝箱的交互、开启动画、战利品抽取和掉落物生命周期。 */
export class TreasureChestRuntime {
  public readonly id: TreasureChestId;
  public readonly x: number;
  public readonly z: number;
  private readonly renderer: TreasureChestRenderer;
  private readonly drops: DroppedEquipmentPopulation;
  private readonly randomState = new Uint32Array(1);
  private phase = TreasureChestPhase.Closed;
  private elapsed = 0;
  private attentionElapsed = 0;
  private playerDistanceSquared = TREASURE_CHEST_ATTENTION.awarenessRadius
    * TREASURE_CHEST_ATTENTION.awarenessRadius;
  private lootReleased = false;
  private disposed = false;

  constructor(
    parent: Node,
    surfaceMaterialTemplate: Material,
    private readonly spawn: Readonly<BattlefieldTreasureChestSpawn>,
    private readonly equipmentLibrary: EquipmentLibrary,
    private readonly lootTable: LootTable<EquipmentId>,
    instanceIds: DroppedEquipmentInstanceIdSequence,
  ) {
    this.id = spawn.id;
    this.x = spawn.x;
    this.z = spawn.z;
    this.randomState[0] = normalizeRandomSeed(spawn.seed);
    this.renderer = new TreasureChestRenderer(
      parent,
      surfaceMaterialTemplate,
      spawn.x,
      spawn.y,
      spawn.z,
      spawn.heading,
    );
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
    this.phase = TreasureChestPhase.Opening;
    this.elapsed = 0;
    return true;
  }

  /** 缓存玩家到宝箱的距离，供下一次固定频率材质提示求值。 */
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
    return this.drops.remove(instanceId);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.drops.dispose();
    this.renderer.dispose();
  }

  /** 通过可替换战利品表抽取装备，并为每件装备生成独立爆散轨迹。 */
  private releaseLoot(): void {
    const equipmentIds = this.lootTable.roll(this.randomState, 0);
    for (const equipmentId of equipmentIds) {
      this.equipmentLibrary.get(equipmentId);
    }
    const trajectories = createLootScatterTrajectories(
      equipmentIds.length,
      this.randomState,
      0,
      this.spawn.x,
      this.spawn.y + TREASURE_CHEST_LAYOUT.lootReleaseHeight,
      this.spawn.z,
    );
    this.drops.spawnBurst(equipmentIds, trajectories);
    this.lootReleased = true;
  }
}
