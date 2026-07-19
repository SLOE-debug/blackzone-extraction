import { type Material, Node } from 'cc';
import { type Disposable } from '../../../../core/contracts/disposable';
import {
  type EquipmentLibrary,
  EquipmentId,
} from '../../../../core/equipment/equipment';
import { type LootTable } from '../../../../core/loot/weighted-loot-table';
import { isSameChunkCoordinate } from '../../../../core/world/chunk-coordinate';
import {
  type ChunkRuntimeParticipant,
  type ChunkRuntimeScope,
} from '../../../../core/world/chunk-runtime-registry';
import { type MutableDroppedEquipmentInspection } from '../../equipment/population/dropped-equipment-population';
import { BattlefieldEnvironmentPopulation } from '../../environment/population/battlefield-environment-population';
import {
  BattlefieldInteractionAction,
  type BattlefieldInteractionProvider,
  type MutableBattlefieldInteractionCandidate,
} from '../../interaction/model/battlefield-interaction';
import {
  BATTLEFIELD_TREASURE_CHEST_SPAWNS,
} from '../model/battlefield-treasure-chest-spawn';
import { TREASURE_CHEST_LAYOUT } from '../model/treasure-chest-layout';
import { TreasureChestRuntime } from './treasure-chest-runtime';

/** 聚合活动 Chunk 的宝箱、开启动画、交互和落地装备查询。 */
export class BattlefieldTreasurePopulation
implements ChunkRuntimeParticipant<BattlefieldEnvironmentPopulation>,
BattlefieldInteractionProvider, Disposable {
  private readonly chests: TreasureChestRuntime[] = [];
  private readonly inspectionCandidate: MutableDroppedEquipmentInspection = {
    equipmentId: EquipmentId.DesertEagle,
    x: 0,
    y: 0,
    z: 0,
  };
  private disposed = false;

  constructor(
    private readonly parent: Node,
    private readonly surfaceMaterialTemplate: Material,
    private readonly equipmentLibrary: EquipmentLibrary,
    private readonly lootTable: LootTable<EquipmentId>,
  ) {}

  /** 为当前 Chunk 清单中的宝箱创建独占运行时并登记到作用域。 */
  public populate(
    scope: ChunkRuntimeScope,
    _environment: BattlefieldEnvironmentPopulation,
  ): void {
    this.ensureActive();
    for (const spawn of BATTLEFIELD_TREASURE_CHEST_SPAWNS) {
      if (!isSameChunkCoordinate(spawn.chunk, scope.chunk)) {
        continue;
      }
      const chest = new TreasureChestRuntime(
        this.parent,
        this.surfaceMaterialTemplate,
        spawn,
        this.equipmentLibrary,
        this.lootTable,
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
  }

  /** 把玩家最新位置同步给全部活动宝箱的低频材质提示。 */
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
  public activateInteraction(sourceId: number): boolean {
    if (this.disposed) {
      return false;
    }
    for (const chest of this.chests) {
      if (chest.id === sourceId) {
        return chest.open();
      }
    }
    return false;
  }

  /** 在全部活动宝箱掉落物中选择离玩家最近的装备。 */
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
    for (const chest of this.chests) {
      if (!chest.writeNearestEquipmentInspection(
        playerX,
        playerZ,
        this.inspectionCandidate,
      )) {
        continue;
      }
      const deltaX = this.inspectionCandidate.x - playerX;
      const deltaZ = this.inspectionCandidate.z - playerZ;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSquared < bestDistanceSquared) {
        result.equipmentId = this.inspectionCandidate.equipmentId;
        result.x = this.inspectionCandidate.x;
        result.y = this.inspectionCandidate.y;
        result.z = this.inspectionCandidate.z;
        bestDistanceSquared = distanceSquared;
        found = true;
      }
    }
    return found;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    while (this.chests.length > 0) {
      this.chests.pop()?.dispose();
    }
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
