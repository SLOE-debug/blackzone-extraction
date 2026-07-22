import { describe, expect, it } from 'vitest';
import { BattlefieldPenetratingHitBuffer } from '../../assets/bundles/battlefield/population/battlefield-penetrating-hit';

describe('战场贯穿命中', () => {
  it('固定缓冲按线段进度排序、去重并在满载时保留最近结果', () => {
    const hits = new BattlefieldPenetratingHitBuffer(3);
    hits.include(1, 4, 4, 0, 0, 0.8);
    hits.include(2, 7, 2, 0, 0, 0.2);
    hits.include(1, 5, 5, 0, 0, 0.5);
    hits.include(1, 4, 1, 0, 0, 0.1);
    hits.include(3, 9, 3, 0, 0, 0.3);
    expect(hits.count).toBe(3);
    expect(Array.from(hits.segmentProgress)).toEqual([
      expect.closeTo(0.2),
      expect.closeTo(0.3),
      expect.closeTo(0.5),
    ]);
    expect(Array.from(hits.populationIds)).toEqual([2, 3, 1]);
  });
});
