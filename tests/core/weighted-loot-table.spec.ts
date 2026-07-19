import { describe, expect, it } from 'vitest';
import { WeightedLootTable } from '../../assets/core/loot/weighted-loot-table';

enum TestLootId {
  First,
  Second,
}

describe('加权战利品表', () => {
  it('在包含上限的配置区间内产生不同数量的掉落', () => {
    const table = new WeightedLootTable<TestLootId>({
      minimumDrops: 1,
      maximumDrops: 3,
      entries: [{ id: TestLootId.First, weight: 1 }],
    });
    const observedCounts = new Set<number>();
    const randomState = Uint32Array.of(0x74a91);
    for (let roll = 0; roll < 64; roll++) {
      const result = table.roll(randomState, 0);
      observedCounts.add(result.length);
      expect(result.every((id) => id === TestLootId.First)).toBe(true);
    }
    expect(observedCounts.size).toBeGreaterThan(1);
    expect(Math.min(...observedCounts)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...observedCounts)).toBeLessThanOrEqual(3);
  });

  it('按权重选择候选并拒绝空表或非法权重', () => {
    const table = new WeightedLootTable<TestLootId>({
      minimumDrops: 20,
      maximumDrops: 20,
      entries: [
        { id: TestLootId.First, weight: 1 },
        { id: TestLootId.Second, weight: 3 },
      ],
    });
    const result = table.roll(Uint32Array.of(0x4173), 0);
    expect(result).toContain(TestLootId.First);
    expect(result).toContain(TestLootId.Second);
    expect(() => new WeightedLootTable({
      minimumDrops: 1,
      maximumDrops: 1,
      entries: [],
    })).toThrow(/至少/);
  });
});
