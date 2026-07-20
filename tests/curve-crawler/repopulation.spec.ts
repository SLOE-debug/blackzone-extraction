import { describe, expect, it } from 'vitest';
import { CurveCrawlerEmergenceSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/animation/curve-crawler-emergence-system';
import { CurveCrawlerLifePhase } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-life';
import { CurveCrawlerState } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-state';
import { CurveCrawlerRepopulationSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/population/curve-crawler-repopulation-system';
import { createNormalizedCurveCrawlerTestOptions } from './state-test-fixture';

const SWARM_OPTIONS = Object.freeze({
  centerX: 30,
  centerY: -20,
  spawnInnerRadius: 18,
  spawnOuterRadius: 32,
  recycleRadius: 49,
  minimumAliveCount: 180,
});

describe('Curve Crawler 玩家周边尸潮回收', () => {
  it('把固定容量槽位均匀放进玩家外圈并立即形成至少 180 个活体', () => {
    const state = createState();
    const repopulation = new CurveCrawlerRepopulationSystem();
    repopulation.initializeAround(state, SWARM_OPTIONS);

    expect(repopulation.countAlive(state)).toBe(220);
    for (let index = 0; index < state.count; index++) {
      const distance = Math.hypot(
        (state.data.transform.x[index] ?? 0) - SWARM_OPTIONS.centerX,
        (state.data.transform.y[index] ?? 0) - SWARM_OPTIONS.centerY,
      );
      expect(distance).toBeGreaterThanOrEqual(SWARM_OPTIONS.spawnInnerRadius);
      expect(distance).toBeLessThan(SWARM_OPTIONS.spawnOuterRadius);
    }
  });

  it('回收远距离实体并在大量死亡阶段中强制补足最低活体数', () => {
    const state = createState();
    const repopulation = new CurveCrawlerRepopulationSystem();
    repopulation.initializeAround(state, SWARM_OPTIONS);
    state.data.transform.x[0] = SWARM_OPTIONS.centerX + SWARM_OPTIONS.recycleRadius + 10;
    for (let index = 1; index <= 55; index++) {
      state.data.vitality.phase[index] = CurveCrawlerLifePhase.Liquefying;
    }

    repopulation.maintainAround(state, SWARM_OPTIONS);

    expect(repopulation.countAlive(state)).toBeGreaterThanOrEqual(180);
    expect(state.data.vitality.phase[0]).toBe(CurveCrawlerLifePhase.Emerging);
    const recycledDistance = Math.hypot(
      (state.data.transform.x[0] ?? 0) - SWARM_OPTIONS.centerX,
      (state.data.transform.y[0] ?? 0) - SWARM_OPTIONS.centerY,
    );
    expect(recycledDistance).toBeLessThan(SWARM_OPTIONS.spawnOuterRadius);
  });

  it('远距离活体回收后从地裂阶段完整重生而不是瞬间出现', () => {
    const state = createState();
    const repopulation = new CurveCrawlerRepopulationSystem();
    const emergence = new CurveCrawlerEmergenceSystem();
    repopulation.initializeAround(state, SWARM_OPTIONS);
    state.data.transform.x[0] = SWARM_OPTIONS.centerX + SWARM_OPTIONS.recycleRadius + 10;

    repopulation.maintainAround(state, SWARM_OPTIONS);

    expect(state.data.vitality.phase[0]).toBe(CurveCrawlerLifePhase.Emerging);
    expect(state.data.animation.emergenceBodyScale[0]).toBe(0);
    emergence.update(state, 0.25);
    expect(state.data.animation.crackVisibility[0]).toBe(1);
    expect(state.data.animation.crackSpread[0]).toBeGreaterThan(0);
    expect(repopulation.countAlive(state)).toBeGreaterThanOrEqual(180);
  });
});

function createState(): CurveCrawlerState {
  return new CurveCrawlerState(createNormalizedCurveCrawlerTestOptions({
    count: 220,
    spawnArea: { centerX: 0, centerY: 0, width: 70, height: 70 },
    seed: 0x4b1ac7,
  }));
}
