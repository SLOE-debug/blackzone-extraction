import { EquipmentId } from '../../../../core/equipment/equipment';
import { type BattlefieldTreasureChestKey } from './battlefield-treasure-chest-key';

interface MutableBattlefieldTreasureChestSessionEntry {
  readonly remainingLoot: EquipmentId[];
  readonly scatterSeed: number;
}

/**
 * 保存单次战场会话中已经打开的宝箱及其尚未拾取的战利品。
 *
 * 活动 Chunk 只拥有渲染和交互运行时；该状态库由战场宝箱人口长期持有，因此
 * Chunk 卸载不会把已打开状态或剩余战利品一起销毁。
 */
export class BattlefieldTreasureChestSessionState {
  private readonly entries = new Map<
    BattlefieldTreasureChestKey,
    MutableBattlefieldTreasureChestSessionEntry
  >();

  public isOpened(key: BattlefieldTreasureChestKey): boolean {
    return this.entries.has(key);
  }

  /** 记录第一次打开时已经确定的战利品，禁止同一宝箱重复抽取。 */
  public open(
    key: BattlefieldTreasureChestKey,
    equipmentIds: readonly EquipmentId[],
    scatterSeed: number,
  ): void {
    if (this.entries.has(key)) {
      throw new Error(`宝箱已经记录为打开状态：${key}`);
    }
    if (!Number.isSafeInteger(scatterSeed)
      || scatterSeed <= 0
      || scatterSeed > 0xffffffff) {
      throw new Error('宝箱战利品爆散种子必须是正安全整数。');
    }
    this.entries.set(key, {
      remainingLoot: Array.from(equipmentIds),
      scatterSeed,
    });
  }

  /** 返回已打开宝箱尚未拾取的只读装备序列；未打开时返回空值。 */
  public getRemainingLoot(
    key: BattlefieldTreasureChestKey,
  ): readonly EquipmentId[] | null {
    return this.entries.get(key)?.remainingLoot ?? null;
  }

  /** 返回第一次开箱时固定的爆散种子；未打开时返回空值。 */
  public getScatterSeed(key: BattlefieldTreasureChestKey): number | null {
    return this.entries.get(key)?.scatterSeed ?? null;
  }

  /** 在玩家成功拾取后从会话状态中消费一件对应装备。 */
  public consumeLoot(
    key: BattlefieldTreasureChestKey,
    equipmentId: EquipmentId,
  ): void {
    const entry = this.entries.get(key);
    if (entry === undefined) {
      throw new Error(`未打开的宝箱不能消费战利品：${key}`);
    }
    const index = entry.remainingLoot.indexOf(equipmentId);
    if (index < 0) {
      throw new Error(`宝箱会话状态中不存在待消费装备：${equipmentId}`);
    }
    entry.remainingLoot.splice(index, 1);
  }
}
