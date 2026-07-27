import { describe, expect, it } from 'vitest';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';
import { createChunkCoordinate } from '../../assets/core/world/chunk-coordinate';
import { createBattlefieldTreasureChestKey } from '../../assets/bundles/battlefield/treasure-chest/model/battlefield-treasure-chest-key';
import { BattlefieldTreasureChestSessionState } from '../../assets/bundles/battlefield/treasure-chest/model/battlefield-treasure-chest-session-state';
import {
  createBattlefieldTreasureChestSpawns,
  type BattlefieldTreasureChestPlacementConstraint,
} from '../../assets/bundles/battlefield/treasure-chest/model/battlefield-treasure-chest-spawn';

const UNCONSTRAINED_PLACEMENT: BattlefieldTreasureChestPlacementConstraint = Object.freeze({
  isAreaClear: (): boolean => true,
});

describe('战场宝箱会话状态', () => {
  it('相同 Chunk 重建时产生完全一致的稳定宝箱 key', () => {
    const first = createBattlefieldTreasureChestSpawns(
      createChunkCoordinate(0, 0),
      UNCONSTRAINED_PLACEMENT,
    );
    const second = createBattlefieldTreasureChestSpawns(
      createChunkCoordinate(0, 0),
      UNCONSTRAINED_PLACEMENT,
    );
    expect(first).toHaveLength(1);
    expect(second[0]?.key).toBe(first[0]?.key);
    expect(createBattlefieldTreasureChestKey(createChunkCoordinate(3, -2), 0))
      .not.toBe(createBattlefieldTreasureChestKey(createChunkCoordinate(3, -2), 1));
  });

  it('跨运行时保存打开状态、爆散种子和剩余战利品', () => {
    const key = createBattlefieldTreasureChestKey(createChunkCoordinate(4, -7), 0);
    const state = new BattlefieldTreasureChestSessionState();
    state.open(
      key,
      [
        { equipmentId: EquipmentId.Sledgehammer, itemInstanceSeed: 301 },
        { equipmentId: EquipmentId.Sledgehammer, itemInstanceSeed: 302 },
      ],
      0x7a91c3,
    );

    expect(state.isOpened(key)).toBe(true);
    expect(state.getScatterSeed(key)).toBe(0x7a91c3);
    expect(state.getRemainingLoot(key)).toEqual([
      { equipmentId: EquipmentId.Sledgehammer, itemInstanceSeed: 301 },
      { equipmentId: EquipmentId.Sledgehammer, itemInstanceSeed: 302 },
    ]);

    state.consumeLoot(key, 301);
    expect(state.getRemainingLoot(key)).toEqual([
      { equipmentId: EquipmentId.Sledgehammer, itemInstanceSeed: 302 },
    ]);
    state.consumeLoot(key, 302);
    expect(state.getRemainingLoot(key)).toEqual([]);
  });

  it('拒绝重复打开同一稳定宝箱或消费不存在的装备', () => {
    const key = createBattlefieldTreasureChestKey(createChunkCoordinate(1, 2), 0);
    const state = new BattlefieldTreasureChestSessionState();
    state.open(key, [{ equipmentId: EquipmentId.Sledgehammer, itemInstanceSeed: 401 }], 17);

    expect(() => state.open(
      key,
      [{ equipmentId: EquipmentId.Sledgehammer, itemInstanceSeed: 402 }],
      19,
    )).toThrow(/已经记录/);
    state.consumeLoot(key, 401);
    expect(() => state.consumeLoot(key, 401)).toThrow(/不存在/);
  });
});
