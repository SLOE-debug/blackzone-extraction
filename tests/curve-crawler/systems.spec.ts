import { describe, expect, it } from 'vitest';
import { CurveCrawlerAnimationSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/animation/curve-crawler-animation-system';
import { CurveCrawlerEmergenceSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/animation/curve-crawler-emergence-system';
import { CurveCrawlerBehaviorSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/behavior/curve-crawler-behavior-system';
import { CurveCrawlerAction } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-action';
import {
  CURVE_CRAWLER_BURST_DURATION,
  CURVE_CRAWLER_LIQUID_DURATION,
  CurveCrawlerLifePhase,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-life';
import { CurveCrawlerState } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-state';
import { CurveCrawlerMovementSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/movement/curve-crawler-movement-system';
import { CurveCrawlerDeathSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/population/curve-crawler-death-system';
import { CurveCrawlerHitSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/population/curve-crawler-hit-system';
import {
  createCurveCrawlerBounds,
  updateCurveCrawlerBounds,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-bounds';
import { CURVE_CRAWLER_EMERGENCE_TIMING } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-emergence';
import {
  completeCurveCrawlerTestEmergence,
  createNormalizedCurveCrawlerTestOptions,
} from './state-test-fixture';

function createState(): CurveCrawlerState {
  const state = new CurveCrawlerState(createNormalizedCurveCrawlerTestOptions({
    count: 2,
    spawnArea: { width: 320, height: 180 },
    seed: 7,
  }));
  completeCurveCrawlerTestEmergence(state);
  return state;
}

describe('Curve Crawler 系统', () => {
  it('出生演出依次推进地裂、蛋壳爆裂和四肢生长后才允许存活', () => {
    const state = new CurveCrawlerState(createNormalizedCurveCrawlerTestOptions({
      count: 1,
      spawnArea: { width: 20, height: 20 },
      seed: 71,
    }));
    const emergence = new CurveCrawlerEmergenceSystem();
    state.data.vitality.phaseTime[0] = 0;

    emergence.update(state, CURVE_CRAWLER_EMERGENCE_TIMING.crackSeconds * 0.5);
    expect(state.data.animation.crackSpread[0] ?? 0).toBeGreaterThan(0);
    expect(state.data.animation.eggScale[0]).toBe(0);
    expect(state.data.vitality.phase[0]).toBe(CurveCrawlerLifePhase.Emerging);

    emergence.update(state,
      CURVE_CRAWLER_EMERGENCE_TIMING.crackSeconds * 0.5
      + CURVE_CRAWLER_EMERGENCE_TIMING.eggGrowthSeconds
      + CURVE_CRAWLER_EMERGENCE_TIMING.eggBulgeSeconds
      + CURVE_CRAWLER_EMERGENCE_TIMING.eggBurstSeconds * 0.5);
    expect(state.data.animation.eggBurst[0] ?? 0).toBeGreaterThan(0);
    expect(state.data.animation.emergenceBodyScale[0] ?? 0).toBeGreaterThan(0);
    expect(state.data.animation.emergenceLegScale[0]).toBe(0);

    emergence.update(state,
      CURVE_CRAWLER_EMERGENCE_TIMING.eggBurstSeconds * 0.5
      + CURVE_CRAWLER_EMERGENCE_TIMING.limbGrowthSeconds);
    expect(state.data.vitality.phase[0]).toBe(CurveCrawlerLifePhase.Alive);
    expect(state.data.animation.emergenceBodyScale[0]).toBe(1);
    expect(state.data.animation.emergenceLegScale[0]).toBe(1);
    expect(state.data.animation.crackVisibility[0]).toBe(0);
  });

  it('疾跑命令统一改变行为并产生高速意图', () => {
    const state = createState();
    const behavior = new CurveCrawlerBehaviorSystem();

    behavior.triggerScuttle(state);
    behavior.update(state, 1 / 60);

    for (let index = 0; index < state.count; index++) {
      expect(state.data.behavior.action[index]).toBe(CurveCrawlerAction.Scuttle);
      expect(state.data.intent.targetSpeed[index] ?? 0).toBeGreaterThan(
        state.data.morphology.cruiseSpeed[index] ?? 0,
      );
    }
  });

  it('相同状态和种子产生确定性的动作切换', () => {
    const first = createState();
    const second = createState();
    const behavior = new CurveCrawlerBehaviorSystem();
    first.data.behavior.actionTime.fill(0);
    second.data.behavior.actionTime.fill(0);

    behavior.update(first, 1 / 60);
    behavior.update(second, 1 / 60);

    expect(Array.from(first.data.behavior.action)).toEqual(Array.from(second.data.behavior.action));
    expect(Array.from(first.data.behavior.actionDuration)).toEqual(
      Array.from(second.data.behavior.actionDuration),
    );
  });

  it('移动系统不会把实体拉回初始生成区域', () => {
    const state = createState();
    const movement = new CurveCrawlerMovementSystem();
    const index = 0;
    state.data.transform.x[index] = 260;
    state.data.intent.targetSpeed[index] = 0;

    movement.update(state, 1 / 60);

    expect(state.data.transform.x[index]).toBe(260);
  });

  it('渲染包围盒会跟随自由移动后的实体位置', () => {
    const state = createState();
    const bounds = createCurveCrawlerBounds(state);
    state.data.transform.x[0] = 1000;

    updateCurveCrawlerBounds(state, bounds);

    expect(bounds.maxX).toBeGreaterThan(1000);
  });

  it('动画系统独立混合步态、啃咬前探和蜷缩姿态', () => {
    const state = createState();
    const animation = new CurveCrawlerAnimationSystem();
    const initialPhase = state.data.animation.phase[0] ?? 0;
    state.data.intent.targetCrouch[0] = 1;
    state.data.intent.targetBite[0] = 1;
    state.data.intent.gaitMultiplier[0] = 1;
    state.data.motion.currentSpeed[0] = state.data.morphology.cruiseSpeed[0] ?? 0;
    state.data.animation.nextBlinkTime[0] = 10;

    animation.update(state, 1 / 60);

    expect(state.data.animation.phase[0]).not.toBe(initialPhase);
    expect(state.data.animation.crouchAmount[0] ?? 0).toBeGreaterThan(0);
    expect(state.data.animation.biteAmount[0] ?? 0).toBeGreaterThan(0);
    expect(Number.isFinite(state.data.animation.bodyPulse[0])).toBe(true);
  });

  it('非致命伤害触发受击闪红但保持存活', () => {
    const state = createState();
    const hit = new CurveCrawlerHitSystem();

    expect(hit.damage(state, 0, 25)).toBe(false);
    hit.update(state, 1 / 60);

    expect(state.data.vitality.health[0]).toBe(75);
    expect(state.data.vitality.phase[0]).toBe(CurveCrawlerLifePhase.Alive);
    expect(state.data.animation.hitFlash[0] ?? 0).toBeGreaterThan(0);
  });

  it('致命伤害依次推进爆裂、液化和消失阶段', () => {
    const state = createState();
    const hit = new CurveCrawlerHitSystem();
    const death = new CurveCrawlerDeathSystem();

    expect(hit.damage(state, 0, 100)).toBe(true);
    death.start(state, 0);
    death.update(state, CURVE_CRAWLER_BURST_DURATION * 0.75);
    expect(state.data.vitality.phase[0]).toBe(CurveCrawlerLifePhase.Bursting);
    expect(state.data.animation.liquidSpread[0] ?? 0).toBeGreaterThan(0);
    const fragmentOffsets = Array.from(state.data.animation.fragmentOffsetX.slice(0, 12));
    expect(new Set(fragmentOffsets.map((value) => value.toFixed(3))).size).toBeGreaterThan(6);
    expect(Math.max(...state.data.animation.fragmentOffsetZ.slice(0, 12))).toBeGreaterThan(2);

    death.update(state, CURVE_CRAWLER_BURST_DURATION * 0.25);
    expect(state.data.vitality.phase[0]).toBe(CurveCrawlerLifePhase.Liquefying);
    expect(state.data.animation.surfaceCollapse[0]).toBe(1);

    death.update(state, CURVE_CRAWLER_LIQUID_DURATION);
    expect(state.data.vitality.phase[0]).toBe(CurveCrawlerLifePhase.Gone);
    expect(state.data.animation.liquidDrain[0]).toBe(1);
  });
});
