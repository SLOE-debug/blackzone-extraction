import { describe, expect, it } from 'vitest';
import { CurveCrawlerState } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-state';
import { CurveCrawlerTargeting } from '../../assets/bundles/common-monsters/entities/curve-crawler/population/curve-crawler-targeting';
import {
  completeCurveCrawlerTestEmergence,
  createNormalizedCurveCrawlerTestOptions,
} from './state-test-fixture';

describe('Curve Crawler 纵向目标射线查询', () => {
  it('中心位于旧六度锥外但射线经过近端腿部时仍返回目标', () => {
    const state = createTargetingState(1);
    state.data.transform.x[0] = 10;
    state.data.transform.y[0] = 2;
    const centerAlignment = 10 / Math.hypot(10, 2);
    const result = createTargetResult();

    const found = new CurveCrawlerTargeting().findEntity(state, 0, {
      startX: 0,
      startY: 0,
      endX: 20,
      endY: 0,
    }, result);

    expect(centerAlignment).toBeLessThan(Math.cos(Math.PI / 30));
    expect(found).toBe(true);
    expect(result.entityId).toBe(0);
    expect(result.elevation).toBeGreaterThan(0);
    expect(result.segmentProgress).toBeGreaterThan(0);
    expect(result.segmentProgress).toBeLessThan(1);
  });

  it('附近存在怪物但射线不经过任何可感知轮廓时不返回目标', () => {
    const state = createTargetingState(1);
    state.data.transform.x[0] = 10;
    state.data.transform.y[0] = 12;

    expect(new CurveCrawlerTargeting().findEntity(state, 0, {
      startX: 0,
      startY: 0,
      endX: 20,
      endY: 0,
    }, createTargetResult())).toBe(false);
  });

  it('近端目标稍偏而远端中心对齐时选择射线最先接触的近端目标', () => {
    const state = createTargetingState(2);
    state.data.transform.x.set([6, 15]);
    state.data.transform.y.set([1.5, 0]);
    const result = createTargetResult();

    const found = new CurveCrawlerTargeting().findFirst(state, {
      startX: 0,
      startY: 0,
      endX: 25,
      endY: 0,
    }, result);

    expect(found).toBe(true);
    expect(result.entityId).toBe(0);
    expect(result.x).toBe(6);
  });
});

function createTargetingState(count: number): CurveCrawlerState {
  const state = new CurveCrawlerState(createNormalizedCurveCrawlerTestOptions({
    count,
    spawnArea: { centerX: 0, centerY: 0, width: 30, height: 30 },
    seed: 73,
  }));
  completeCurveCrawlerTestEmergence(state);
  state.data.transform.heading.fill(0);
  state.data.transform.headingCosine.fill(1);
  state.data.transform.headingSine.fill(0);
  state.data.morphology.bodyWidth.fill(4);
  state.data.morphology.bodyLength.fill(6);
  state.data.morphology.legLength.fill(10);
  state.data.morphology.legWidth.fill(0.8);
  state.data.animation.bodyPulse.fill(0);
  state.data.animation.crouchAmount.fill(0);
  state.data.animation.biteAmount.fill(0);
  state.data.animation.turnAmount.fill(0);
  return state;
}

function createTargetResult() {
  return {
    entityId: -1,
    x: 0,
    y: 0,
    elevation: 0,
    segmentProgress: 0,
  };
}
