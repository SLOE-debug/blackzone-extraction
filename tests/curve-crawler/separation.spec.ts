import { describe, expect, it } from 'vitest';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { calculateCurveCrawlerSeparationRadius } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-separation-profile';
import { CurveCrawlerState } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-state';
import { CurveCrawlerSeparationSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/movement/curve-crawler-separation-system';
import {
  completeCurveCrawlerTestEmergence,
  createNormalizedCurveCrawlerTestOptions,
} from './state-test-fixture';

describe('Curve Crawler 空间哈希分离', () => {
  it('把高密度活体群逐步推出彼此占地范围且保持有限坐标', () => {
    const state = createState(48);
    completeCurveCrawlerTestEmergence(state);
    for (let index = 0; index < state.count; index++) {
      state.data.transform.x[index] = (index % 8) * 1.4;
      state.data.transform.y[index] = Math.floor(index / 8) * 1.4;
    }
    const separation = new CurveCrawlerSeparationSystem(state.count);
    const initialOverlapCount = countOverlappingPairs(state);

    for (let frame = 0; frame < 240; frame++) {
      separation.update(state, 1 / 60);
    }

    expect(initialOverlapCount).toBeGreaterThan(500);
    expect(countOverlappingPairs(state, 0.08)).toBe(0);
    for (let index = 0; index < state.count; index++) {
      expect(Number.isFinite(state.data.transform.x[index])).toBe(true);
      expect(Number.isFinite(state.data.transform.y[index])).toBe(true);
    }
  });

  it('完全同坐标实体使用稳定方向拆分且不移动非活体槽位', () => {
    const state = createState(3);
    completeCurveCrawlerTestEmergence(state);
    state.data.transform.x.fill(4);
    state.data.transform.y.fill(-2);
    state.data.vitality.state[2] = MonsterLifecycleState.Dying;
    const separation = new CurveCrawlerSeparationSystem(state.count);

    for (let frame = 0; frame < 90; frame++) {
      separation.update(state, 1 / 60);
    }

    expect(Math.hypot(
      (state.data.transform.x[1] ?? 0) - (state.data.transform.x[0] ?? 0),
      (state.data.transform.y[1] ?? 0) - (state.data.transform.y[0] ?? 0),
    )).toBeGreaterThan(9.8);
    expect(state.data.transform.x[2]).toBe(4);
    expect(state.data.transform.y[2]).toBe(-2);
  });
});

function createState(count: number): CurveCrawlerState {
  return new CurveCrawlerState(createNormalizedCurveCrawlerTestOptions({
    count,
    spawnArea: { centerX: 0, centerY: 0, width: 80, height: 80 },
    seed: 0x3c89e1,
  }));
}

function countOverlappingPairs(state: CurveCrawlerState, tolerance = 0): number {
  const { transform, morphology, vitality } = state.data;
  let count = 0;
  for (let first = 0; first < state.count; first++) {
    if ((vitality.state[first] as MonsterLifecycleState) !== MonsterLifecycleState.Alive) {
      continue;
    }
    const firstRadius = calculateCurveCrawlerSeparationRadius(
      morphology.bodyWidth[first] ?? 0,
      morphology.legLength[first] ?? 0,
      morphology.legWidth[first] ?? 0,
    );
    for (let second = first + 1; second < state.count; second++) {
      if ((vitality.state[second] as MonsterLifecycleState)
        !== MonsterLifecycleState.Alive) {
        continue;
      }
      const secondRadius = calculateCurveCrawlerSeparationRadius(
        morphology.bodyWidth[second] ?? 0,
        morphology.legLength[second] ?? 0,
        morphology.legWidth[second] ?? 0,
      );
      const distance = Math.hypot(
        (transform.x[second] ?? 0) - (transform.x[first] ?? 0),
        (transform.y[second] ?? 0) - (transform.y[first] ?? 0),
      );
      if (distance + tolerance < firstRadius + secondRadius) {
        count++;
      }
    }
  }
  return count;
}
