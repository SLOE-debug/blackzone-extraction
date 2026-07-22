import { describe, expect, it } from 'vitest';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { CurveCrawlerDeathSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/population/curve-crawler-death-system';
import { CurveCrawlerHitSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/population/curve-crawler-hit-system';
import { CurveCrawlerRepopulationSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/population/curve-crawler-repopulation-system';
import {
  CURVE_CRAWLER_BURST_DURATION,
  CURVE_CRAWLER_LIQUID_DURATION,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-life';
import { CURVE_CRAWLER_FRAGMENT_COUNT } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-schema';
import { CurveCrawlerState } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-state';
import { createNormalizedCurveCrawlerTestOptions } from './state-test-fixture';

const SWARM_OPTIONS = Object.freeze({
  centerX: 30,
  centerY: -20,
  spawnInnerRadius: 18,
  spawnOuterRadius: 32,
  recycleRadius: 49,
  hardRecycleRadius: 70,
  desiredPopulationCount: 8,
});
const OUTSIDE_FRUSTUM = Object.freeze({ isVisible: () => false });

describe('Curve Crawler 玩家周边尸潮回收', () => {
  it('只激活当前波次需要的槽位并逐只错峰进入出生状态', () => {
    const state = createState();
    const repopulation = new CurveCrawlerRepopulationSystem(state);

    repopulation.maintainAround(SWARM_OPTIONS, OUTSIDE_FRUSTUM);

    expect(repopulation.countAlive()).toBe(0);
    for (let index = 0; index < state.count; index++) {
      const lifecycleState = state.data.vitality.state[index] as MonsterLifecycleState;
      if (index >= SWARM_OPTIONS.desiredPopulationCount) {
        expect(lifecycleState).toBe(MonsterLifecycleState.Dormant);
        continue;
      }
      expect(lifecycleState).toBe(MonsterLifecycleState.Spawning);
      const distance = Math.hypot(
        (state.data.transform.x[index] ?? 0) - SWARM_OPTIONS.centerX,
        (state.data.transform.y[index] ?? 0) - SWARM_OPTIONS.centerY,
      );
      expect(distance).toBeGreaterThanOrEqual(SWARM_OPTIONS.spawnInnerRadius);
      expect(distance).toBeLessThan(SWARM_OPTIONS.spawnOuterRadius);
    }
    expect(state.data.vitality.stateTime[1] ?? 0).toBeLessThan(
      state.data.vitality.stateTime[0] ?? 0,
    );
  });

  it('人口目标不会覆盖正在爆裂或液化的死亡槽位', () => {
    const state = createState();
    const repopulation = new CurveCrawlerRepopulationSystem(state);
    const hit = new CurveCrawlerHitSystem();
    const death = new CurveCrawlerDeathSystem();
    repopulation.maintainAround(SWARM_OPTIONS, OUTSIDE_FRUSTUM);
    completeActivatedSlots(state, SWARM_OPTIONS.desiredPopulationCount);
    for (let index = 0; index < 5; index++) {
      expect(hit.damage(state, index, 100)).toBe(true);
      death.start(state, index);
    }

    repopulation.maintainAround(SWARM_OPTIONS, OUTSIDE_FRUSTUM);
    death.update(state, CURVE_CRAWLER_BURST_DURATION * 0.5);
    repopulation.maintainAround(SWARM_OPTIONS, OUTSIDE_FRUSTUM);

    for (let index = 0; index < 5; index++) {
      expect(state.data.vitality.state[index]).toBe(MonsterLifecycleState.Dying);
      expect(state.data.animation.fragmentOffsetZ[
        index * CURVE_CRAWLER_FRAGMENT_COUNT
      ] ?? 0).toBeGreaterThan(0);
    }
  });

  it('只有死亡完整结束后才复用槽位并重新播放出生动画', () => {
    const state = createState();
    const repopulation = new CurveCrawlerRepopulationSystem(state);
    const hit = new CurveCrawlerHitSystem();
    const death = new CurveCrawlerDeathSystem();
    const options = Object.freeze({ ...SWARM_OPTIONS, desiredPopulationCount: 2 });
    repopulation.maintainAround(options, OUTSIDE_FRUSTUM);
    completeActivatedSlots(state, options.desiredPopulationCount);
    expect(hit.damage(state, 0, 100)).toBe(true);
    death.start(state, 0);
    death.update(state, CURVE_CRAWLER_BURST_DURATION);
    death.update(state, CURVE_CRAWLER_LIQUID_DURATION);
    expect(state.data.vitality.state[0]).toBe(MonsterLifecycleState.DeathComplete);

    repopulation.maintainAround(options, OUTSIDE_FRUSTUM);

    expect(state.data.vitality.state[0]).toBe(MonsterLifecycleState.Spawning);
    expect(state.data.animation.emergenceBodyScale[0]).toBe(0);
    expect(state.data.animation.emergenceLegScale[0]).toBe(0);
    expect(state.data.animation.surfaceCollapse[0]).toBe(0);
  });

  it('远距离回收不会截断死亡状态，只会重启出生或存活实体', () => {
    const state = createState();
    const repopulation = new CurveCrawlerRepopulationSystem(state);
    const hit = new CurveCrawlerHitSystem();
    const death = new CurveCrawlerDeathSystem();
    const options = Object.freeze({ ...SWARM_OPTIONS, desiredPopulationCount: 2 });
    repopulation.maintainAround(options, OUTSIDE_FRUSTUM);
    completeActivatedSlots(state, options.desiredPopulationCount);
    state.data.transform.x[0] = options.centerX + options.recycleRadius + 10;
    state.data.transform.x[1] = options.centerX + options.recycleRadius + 10;
    expect(hit.damage(state, 1, 100)).toBe(true);
    death.start(state, 1);

    repopulation.maintainAround(options, OUTSIDE_FRUSTUM);

    expect(state.data.vitality.state[0]).toBe(MonsterLifecycleState.Despawning);
    expect(state.data.vitality.state[1]).toBe(MonsterLifecycleState.Dying);
  });
});

function createState(): CurveCrawlerState {
  return new CurveCrawlerState(createNormalizedCurveCrawlerTestOptions({
    count: 12,
    initialPopulationCount: 0,
    spawnArea: { centerX: 0, centerY: 0, width: 70, height: 70 },
    seed: 0x4b1ac7,
  }));
}

function completeActivatedSlots(state: CurveCrawlerState, count: number): void {
  for (let index = 0; index < count; index++) {
    state.data.vitality.state[index] = MonsterLifecycleState.Alive;
    state.data.vitality.stateTime[index] = 0;
    state.data.animation.eggBurst[index] = 1;
    state.data.animation.emergenceBodyScale[index] = 1;
    state.data.animation.emergenceLegScale[index] = 1;
  }
}
