import { type Material, Node } from 'cc';
import { type Disposable } from '../../../../core/contracts/disposable';
import {
  type EquipmentLibrary,
  EquipmentId,
} from '../../../../core/equipment/equipment';
import { type LootTable } from '../../../../core/loot/weighted-loot-table';
import {
  type ChunkRuntimeParticipant,
  type ChunkRuntimeScope,
} from '../../../../core/world/chunk-runtime-registry';
import {
  DroppedEquipmentPopulation,
  DroppedEquipmentInstanceIdSequence,
  type MutableDroppedEquipmentInspection,
} from '../../equipment/population/dropped-equipment-population';
import { BattlefieldEnvironmentPopulation } from '../../environment/population/battlefield-environment-population';
import {
  BattlefieldInteractionAction,
  type BattlefieldInteractionProvider,
  type MutableBattlefieldInteractionCandidate,
} from '../../interaction/model/battlefield-interaction';
import { createLootRuntimeRandomSeed } from '../../loot/model/loot-scatter-random-seed';
import { createPlayerDiscardTrajectory } from '../../loot/model/player-discard-trajectory';
import { createBattlefieldTreasureChestSpawns } from '../model/battlefield-treasure-chest-spawn';
import { BATTLEFIELD_TREASURE_CHEST_ENVIRONMENT_BLOCKERS } from '../model/battlefield-treasure-chest-environment';
import { BattlefieldTreasureChestSessionState } from '../model/battlefield-treasure-chest-session-state';
import { TREASURE_CHEST_LAYOUT } from '../model/treasure-chest-layout';
import { TreasureChestSharedRenderer } from '../rendering/treasure-chest-shared-renderer';
import { TreasureChestRuntime } from './treasure-chest-runtime';

/** 聚合活动 Chunk 的宝箱、开启动画、交互和落地装备查询。 */
export class BattlefieldTreasurePopulation
implements ChunkRuntimeParticipant<BattlefieldEnvironmentPopulation>,
BattlefieldInteractionProvider, Disposable {
  private readonly chests: TreasureChestRuntime[] = [];
  private readonly inspectionCandidate: MutableDroppedEquipmentInspection = {
    instanceId: -1,
    equipmentId: EquipmentId.DesertEagle,
    x: 0,
    y: 0,
    z: 0,
  };
  private readonly equipmentInstanceIds = new DroppedEquipmentInstanceIdSequence();
  private readonly sessionState = new BattlefieldTreasureChestSessionState();
  private readonly renderer: TreasureChestSharedRenderer;
  private readonly discardedEquipment: DroppedEquipmentPopulation;
  private readonly discardRandomState = new Uint32Array(1);
  private nextTreasureChestId = 1;
  private disposed = false;

  constructor(
    private readonly parent: Node,
    private readonly surfaceMaterialTemplate: Material,
    private readonly equipmentLibrary: EquipmentLibrary,
    private readonly lootTable: LootTable<EquipmentId>,
  ) {
    this.renderer = new TreasureChestSharedRenderer(parent, surfaceMaterialTemplate);
    try {
      this.discardedEquipment = new DroppedEquipmentPopulation(
        parent,
        surfaceMaterialTemplate,
        this.equipmentInstanceIds,
      );
    } catch (error: unknown) {
      this.renderer.dispose();
      throw error;
    }
    this.discardRandomState[0] = createLootRuntimeRandomSeed(0x3c6ef35f);
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
        this.parent,
        this.surfaceMaterialTemplate,
        this.renderer,
        spawn,
        this.sessionState,
        this.equipmentLibrary,
        this.lootTable,
        this.equipmentInstanceIds,
      );
      this.chests.push(chest);
      scope.own(new TreasureChestOwnership(this.chests, chest));
    }
  }

  public update(deltaTime: number): void {
    if (this.disposed) {
      return;
    }
    for (const chest of this.chests) {
      chest.update(deltaTime);
    }
    this.discardedEquipment.update(deltaTime);
    this.renderer.synchronize();
  }

  /** 场景激活前提交加载阶段已经登记的全部初始宝箱。 */
  public completeInitialRendering(): void {
    this.ensureActive();
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
    let found = false;
    let bestDistanceSquared = Number.POSITIVE_INFINITY;
    if (this.discardedEquipment.writeNearestInspection(
      playerX,
      playerZ,
      this.inspectionCandidate,
    )) {
      bestDistanceSquared = copyInspectionIfCloser(
        this.inspectionCandidate,
        playerX,
        playerZ,
        bestDistanceSquared,
        result,
      );
      found = true;
    }
    for (const chest of this.chests) {
      if (!chest.writeNearestEquipmentInspection(
        playerX,
        playerZ,
        this.inspectionCandidate,
      )) {
        continue;
      }
      const nextBestDistanceSquared = copyInspectionIfCloser(
        this.inspectionCandidate,
        playerX,
        playerZ,
        bestDistanceSquared,
        result,
      );
      if (nextBestDistanceSquared < bestDistanceSquared) {
        bestDistanceSquared = nextBestDistanceSquared;
        found = true;
      }
    }
    return found;
  }

  /** 在宝箱掉落与玩家替换掉落中查找指定装备实例。 */
  public getDroppedEquipmentId(instanceId: number): EquipmentId | null {
    if (this.disposed) {
      return null;
    }
    const discardedEquipmentId = this.discardedEquipment.getEquipmentId(instanceId);
    if (discardedEquipmentId !== null) {
      return discardedEquipmentId;
    }
    for (const chest of this.chests) {
      const equipmentId = chest.getDroppedEquipmentId(instanceId);
      if (equipmentId !== null) {
        return equipmentId;
      }
    }
    return null;
  }

  /** 从拥有指定实例的掉落群体中移除已经完成拾取的装备。 */
  public removeDroppedEquipment(instanceId: number): boolean {
    if (this.disposed) {
      return false;
    }
    if (this.discardedEquipment.remove(instanceId)) {
      return true;
    }
    for (const chest of this.chests) {
      if (chest.removeDroppedEquipment(instanceId)) {
        return true;
      }
    }
    return false;
  }

  /** 把玩家刚替换下来的武器以克制弧线轻抛到脚边。 */
  public spawnPlayerDiscard(
    equipmentId: EquipmentId,
    x: number,
    y: number,
    z: number,
    heading: number,
  ): void {
    this.ensureActive();
    this.equipmentLibrary.get(equipmentId);
    const trajectory = createPlayerDiscardTrajectory(
      this.discardRandomState,
      0,
      x,
      y,
      z,
      heading,
    );
    this.discardedEquipment.spawnBurst(
      Object.freeze([equipmentId]),
      Object.freeze([trajectory]),
    );
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    while (this.chests.length > 0) {
      this.chests.pop()?.dispose();
    }
    this.discardedEquipment.dispose();
    this.renderer.dispose();
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('战场宝箱群体已经释放。');
    }
  }
}

/** 仅在候选更近时复制 HUD 查询结果，并返回新的最短平方距离。 */
function copyInspectionIfCloser(
  candidate: Readonly<MutableDroppedEquipmentInspection>,
  playerX: number,
  playerZ: number,
  bestDistanceSquared: number,
  result: MutableDroppedEquipmentInspection,
): number {
  const deltaX = candidate.x - playerX;
  const deltaZ = candidate.z - playerZ;
  const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
  if (distanceSquared >= bestDistanceSquared) {
    return bestDistanceSquared;
  }
  result.equipmentId = candidate.equipmentId;
  result.instanceId = candidate.instanceId;
  result.x = candidate.x;
  result.y = candidate.y;
  result.z = candidate.z;
  return distanceSquared;
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
