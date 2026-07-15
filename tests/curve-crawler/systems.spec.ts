import { describe, expect, it } from 'vitest';
import { CurveCrawlerAnimationSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/animation/curve-crawler-animation-system';
import { CurveCrawlerBehaviorSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/behavior/curve-crawler-behavior-system';
import { CurveCrawlerAction } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-action';
import { normalizeCurveCrawlerOptions } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-options';
import { CurveCrawlerState } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-state';
import { CurveCrawlerMovementSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/movement/curve-crawler-movement-system';
import {
  createCurveCrawlerBounds,
  updateCurveCrawlerBounds,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/rendering/curve-crawler-bounds';

function createState(): CurveCrawlerState {
  return new CurveCrawlerState(normalizeCurveCrawlerOptions({
    count: 2,
    spawnArea: { width: 320, height: 180 },
    seed: 7,
  }));
}

describe('Curve Crawler 系统', () => {
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

  it('动画系统独立混合步态、挥腿和蜷缩姿态', () => {
    const state = createState();
    const animation = new CurveCrawlerAnimationSystem();
    const initialPhase = state.data.animation.phase[0] ?? 0;
    state.data.intent.targetCrouch[0] = 1;
    state.data.intent.targetWave[0] = 1;
    state.data.intent.gaitMultiplier[0] = 1;
    state.data.motion.currentSpeed[0] = state.data.morphology.cruiseSpeed[0] ?? 0;
    state.data.animation.nextBlinkTime[0] = 10;

    animation.update(state, 1 / 60);

    expect(state.data.animation.phase[0]).not.toBe(initialPhase);
    expect(state.data.animation.crouchAmount[0] ?? 0).toBeGreaterThan(0);
    expect(state.data.animation.waveAmount[0] ?? 0).toBeGreaterThan(0);
    expect(Number.isFinite(state.data.animation.bodyPulse[0])).toBe(true);
  });
});
