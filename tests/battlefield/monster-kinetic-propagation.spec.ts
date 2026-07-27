import { describe, expect, it } from 'vitest';
import { BATTLEFIELD_KINETIC_PROPAGATION_CONFIG } from '../../assets/bundles/battlefield/combat/effects/battlefield-kinetic-propagation-config';
import {
  calculateKineticResistance,
  calculatePropagationFloor,
} from '../../assets/bundles/battlefield/combat/effects/battlefield-kinetic-propagation-profile';
import { BATTLEFIELD_MONSTER_SPAWN } from '../../assets/bundles/battlefield/model/battlefield-monster-spawn';
import {
  createKineticTestKnockback,
  createMonsterEffectRuntime,
  createMonsterEffectTestGroup,
} from './monster-effects-test-fixture';

const FRAME_SECONDS = 0.002;
const SIMULATION_SECONDS = 0.8;

describe('怪物动量可见传播', () => {
  it('传播软化重型抗性并按代数提供逐层衰减的最低速度', () => {
    const config = BATTLEFIELD_KINETIC_PROPAGATION_CONFIG;
    expect(calculateKineticResistance(0.58)).toBeCloseTo(0.853, 6);
    expect(calculatePropagationFloor(1, config)).toBeCloseTo(9, 6);
    expect(calculatePropagationFloor(2, config)).toBeCloseTo(5.58, 6);
    expect(calculatePropagationFloor(3, config)).toBeCloseTo(3.4596, 6);
    expect(calculatePropagationFloor(4, config)).toBeCloseTo(2.144952, 6);
    expect(calculatePropagationFloor(5, config)).toBe(1.5);
  });

  it('直线怪群在零点八秒内形成肉眼可见的四层位移', () => {
    const starts = [0, 1.4, 2.8, 4.2] as const;
    const group = createMonsterEffectTestGroup(1, starts);
    const { effects, crowd } = createMonsterEffectRuntime(20, group);
    effects.applyKnockback(1, 0, {
      ...createKineticTestKnockback(36),
      remainingSeconds: 0.55,
    });
    effects.applyKineticCarrier(1, 0, 11, 100, 90);
    simulate(effects, crowd, SIMULATION_SECONDS);

    const displacements = starts.map((start, entityId) => Math.abs(
      (group.crowdPopulation.x[entityId] ?? start) - start,
    ) * BATTLEFIELD_MONSTER_SPAWN.modelScale);
    expect(displacements[0]).toBeGreaterThanOrEqual(4);
    expect(displacements[1]).toBeGreaterThanOrEqual(2);
    expect(displacements[2]).toBeGreaterThanOrEqual(0.6);
    expect(displacements[3]).toBeGreaterThanOrEqual(0.2);
  });

  it('旋风近处目标腾空远飞而外层目标只接收地面震退', () => {
    const starts = [0, 1.4, 2.8] as const;
    const group = createMonsterEffectTestGroup(5, starts);
    const { effects, crowd } = createMonsterEffectRuntime(20, group);
    effects.applyKnockback(5, 0, {
      ...createKineticTestKnockback(32),
      remainingSeconds: 1,
      maximumSpeed: 80,
    });
    effects.applyDirectionalLaunch(5, 0, {
      directionX: 1,
      directionZ: 0,
      targetHeight: 5.2,
      horizontalSpeed: 18,
      horizontalDrag: 0.55,
      gravityScale: 1,
      landingDamageBase: 0,
    });
    effects.applyKineticCarrier(5, 0, 14, 100, 90);
    simulate(effects, crowd, SIMULATION_SECONDS);

    const directDisplacement = Math.abs((group.crowdPopulation.x[0] ?? 0) - starts[0])
      * BATTLEFIELD_MONSTER_SPAWN.modelScale;
    const outerDisplacement = Math.abs((group.crowdPopulation.x[1] ?? 1.4) - starts[1])
      * BATTLEFIELD_MONSTER_SPAWN.modelScale;
    expect(directDisplacement).toBeGreaterThanOrEqual(15);
    expect(outerDisplacement).toBeGreaterThanOrEqual(2);
    expect(group.airborne[0]).toBe(1);
    expect(group.airborne[1]).toBe(0);
    expect(group.airborne[2]).toBe(0);
  });

  it('重型怪物不会成为动量墙且其后普通怪物仍有清晰位移', () => {
    const normalGroup = createMonsterEffectTestGroup(2, [0, 2.8]);
    const heavyGroup = createMonsterEffectTestGroup(3, [1.4], {
      launchable: true,
      heightScale: 0.7,
      horizontalScale: 0.7,
      knockbackScale: 0.58,
    });
    const { effects, crowd } = createMonsterEffectRuntime(20, normalGroup, heavyGroup);
    effects.applyKnockback(2, 0, {
      ...createKineticTestKnockback(36),
      remainingSeconds: 0.55,
    });
    effects.applyKineticCarrier(2, 0, 12, 100, 90);
    simulate(effects, crowd, SIMULATION_SECONDS);

    const heavyDisplacement = Math.abs((heavyGroup.crowdPopulation.x[0] ?? 1.4) - 1.4)
      * BATTLEFIELD_MONSTER_SPAWN.modelScale;
    const trailingDisplacement = Math.abs((normalGroup.crowdPopulation.x[1] ?? 2.8) - 2.8)
      * BATTLEFIELD_MONSTER_SPAWN.modelScale;
    expect(heavyDisplacement).toBeGreaterThanOrEqual(1.2);
    expect(trailingDisplacement).toBeGreaterThanOrEqual(0.35);
  });

  it('三秒后动量与击退均结束且怪物不再永久滑动', () => {
    const group = createMonsterEffectTestGroup(4, [0, 1.4, 2.8]);
    const { effects, crowd } = createMonsterEffectRuntime(20, group);
    effects.applyKnockback(4, 0, {
      ...createKineticTestKnockback(36),
      remainingSeconds: 0.55,
    });
    effects.applyKineticCarrier(4, 0, 13, 100, 90);
    simulate(effects, crowd, 3);
    const settledPositions = Array.from(group.crowdPopulation.x);
    simulate(effects, crowd, 0.5);
    expect(Array.from(group.crowdPopulation.x)).toEqual(settledPositions);
  });
});

function simulate(
  effects: ReturnType<typeof createMonsterEffectRuntime>['effects'],
  crowd: ReturnType<typeof createMonsterEffectRuntime>['crowd'],
  durationSeconds: number,
): void {
  const frameCount = Math.ceil(durationSeconds / FRAME_SECONDS);
  for (let frame = 0; frame < frameCount; frame++) {
    effects.update(FRAME_SECONDS);
    crowd.rebuild();
  }
}
