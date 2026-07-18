import { describe, expect, it } from 'vitest';
import { CurveCrawlerLifePhase } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-life';
import { CurveCrawlerState } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-state';
import { CurveCrawlerTargeting } from '../../assets/bundles/common-monsters/entities/curve-crawler/population/curve-crawler-targeting';
import { createNormalizedCurveCrawlerTestOptions } from './state-test-fixture';

describe('Curve Crawler 辅助瞄准查询', () => {
  it('优先选择瞄准锥内方向更准确的存活目标', () => {
    const state = new CurveCrawlerState(createNormalizedCurveCrawlerTestOptions({
      count: 3,
      spawnArea: { width: 20, height: 20 },
      seed: 73,
    }));
    state.data.transform.x.set([10, 5, 3]);
    state.data.transform.y.set([0, 2, 0]);
    state.data.vitality.phase[2] = CurveCrawlerLifePhase.Gone;
    const result = { entityId: -1, x: 0, y: 0 };

    const found = new CurveCrawlerTargeting().findBest(state, {
      originX: 0,
      originY: 0,
      directionX: 1,
      directionY: 0,
      maximumDistance: 15,
      minimumAlignment: 0.9,
    }, result);

    expect(found).toBe(true);
    expect(result.entityId).toBe(0);
    expect(result.x).toBe(10);
    expect(result.y).toBe(0);
  });

  it('目标超出距离或吸附角时不返回候选', () => {
    const state = new CurveCrawlerState(createNormalizedCurveCrawlerTestOptions({
      count: 1,
      spawnArea: { width: 8, height: 8 },
      seed: 91,
    }));
    state.data.transform.x[0] = 0;
    state.data.transform.y[0] = 7;

    expect(new CurveCrawlerTargeting().findBest(state, {
      originX: 0,
      originY: 0,
      directionX: 1,
      directionY: 0,
      maximumDistance: 5,
      minimumAlignment: 0.8,
    }, { entityId: -1, x: 0, y: 0 })).toBe(false);
  });
});
