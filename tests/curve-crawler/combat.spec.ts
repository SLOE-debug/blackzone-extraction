import { describe, expect, it } from 'vitest';
import { CurveCrawlerBehaviorSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/behavior/curve-crawler-behavior-system';
import { CurveCrawlerCombatSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/behavior/curve-crawler-combat-system';
import { CurveCrawlerAction } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-action';
import { type CurveCrawlerCombatOptions } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-combat-options';
import { CurveCrawlerState } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-state';
import { createNormalizedCurveCrawlerTestOptions } from './state-test-fixture';

const COMBAT_OPTIONS = Object.freeze({
  detectionRadius: 10,
  disengageRadius: 14,
  attackReach: 1,
  impactTolerance: 0.25,
  pursuitSpeedMultiplier: 3,
  damage: 7,
  biteTiming: Object.freeze({
    windupSeconds: 0.3,
    strikeSeconds: 0.16,
    recoverySeconds: 0.4,
    cooldownSeconds: 0.7,
  }),
}) satisfies CurveCrawlerCombatOptions;

function createState(count = 4): CurveCrawlerState {
  const state = new CurveCrawlerState(createNormalizedCurveCrawlerTestOptions({
    count,
    spawnArea: { width: 40, height: 40 },
    seed: 17,
  }));
  state.data.transform.x.fill(0);
  state.data.transform.y.fill(0);
  state.data.transform.heading.fill(Math.PI * 0.5);
  state.data.transform.targetHeading.fill(Math.PI * 0.5);
  return state;
}

describe('Curve Crawler 自主战斗', () => {
  it('只在感知半径内锁定目标并用高速爬行意图追击', () => {
    const state = createState(1);
    const combat = new CurveCrawlerCombatSystem(COMBAT_OPTIONS);
    combat.synchronizeTarget({ x: 11, y: 0, collisionRadius: 0.4 });

    combat.update(state, 1 / 60);
    expect(state.data.combat.engaged[0]).toBe(0);

    combat.synchronizeTarget({ x: 6, y: 0, collisionRadius: 0.4 });
    combat.update(state, 1 / 60);

    expect(state.data.combat.engaged[0]).toBe(1);
    expect(state.data.behavior.action[0]).toBe(CurveCrawlerAction.Pursue);
    expect(state.data.intent.targetSpeed[0] ?? 0).toBeCloseTo(
      (state.data.morphology.cruiseSpeed[0] ?? 0) * COMBAT_OPTIONS.pursuitSpeedMultiplier,
    );
    expect(state.data.transform.targetHeading[0]).toBeCloseTo(0);
  });

  it('锁定后使用更大的脱战半径，避免感知边界反复切换', () => {
    const state = createState(1);
    const combat = new CurveCrawlerCombatSystem(COMBAT_OPTIONS);
    combat.synchronizeTarget({ x: 8, y: 0, collisionRadius: 0.4 });
    combat.update(state, 1 / 60);

    combat.synchronizeTarget({ x: 12, y: 0, collisionRadius: 0.4 });
    combat.update(state, 1 / 60);
    expect(state.data.combat.engaged[0]).toBe(1);

    combat.synchronizeTarget({ x: 15, y: 0, collisionRadius: 0.4 });
    combat.update(state, 1 / 60);
    expect(state.data.combat.engaged[0]).toBe(0);
  });

  it('全部贴身且冷却就绪的实体都会啃咬，并只在唯一命中帧聚合伤害', () => {
    const state = createState();
    const combat = new CurveCrawlerCombatSystem(COMBAT_OPTIONS);
    combat.synchronizeTarget({ x: 1, y: 0, collisionRadius: 0.4 });
    combat.update(state, 1 / 60);

    expect(Array.from(state.data.behavior.action).filter(
      (action) => action === CurveCrawlerAction.Bite,
    )).toHaveLength(state.count);
    expect(state.data.intent.targetSpeed[0]).toBe(0);
    expect(state.data.intent.speedSharpness[0] ?? 0).toBeGreaterThan(20);

    for (let step = 0; step < 8; step++) {
      combat.update(state, 0.05);
    }
    expect(combat.consumeAttackDamage()).toBe(
      COMBAT_OPTIONS.damage * state.count,
    );
    expect(combat.consumeAttackDamage()).toBe(0);
  });

  it('目标在命中前离开有效距离时，啃咬动作不会造成伤害', () => {
    const state = createState(1);
    const combat = new CurveCrawlerCombatSystem(COMBAT_OPTIONS);
    combat.synchronizeTarget({ x: 1, y: 0, collisionRadius: 0.4 });
    combat.update(state, 1 / 60);
    expect(state.data.behavior.action[0]).toBe(CurveCrawlerAction.Bite);

    combat.synchronizeTarget({ x: 3, y: 0, collisionRadius: 0.4 });
    for (let step = 0; step < 8; step++) {
      combat.update(state, 0.05);
    }
    expect(combat.consumeAttackDamage()).toBe(0);
  });

  it('战斗接管后自主随机行为不会覆盖追击动作', () => {
    const state = createState(1);
    const combat = new CurveCrawlerCombatSystem(COMBAT_OPTIONS);
    const behavior = new CurveCrawlerBehaviorSystem();
    combat.synchronizeTarget({ x: 6, y: 0, collisionRadius: 0.4 });
    combat.update(state, 1 / 60);
    state.data.behavior.actionTime[0] = 0;

    behavior.update(state, 1 / 60);
    expect(state.data.behavior.action[0]).toBe(CurveCrawlerAction.Pursue);
  });
});
