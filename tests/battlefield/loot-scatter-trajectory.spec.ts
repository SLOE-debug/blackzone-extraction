import { describe, expect, it, vi } from 'vitest';
import { createLootRuntimeRandomSeed } from '../../assets/bundles/battlefield/loot/model/loot-scatter-random-seed';
import { createPlayerDiscardTrajectory } from '../../assets/bundles/battlefield/loot/model/player-discard-trajectory';
import {
  createLootScatterTrajectories,
  evaluateLootScatterTrajectory,
  LootScatterPhase,
} from '../../assets/bundles/battlefield/loot/model/loot-scatter-trajectory';

describe('宝箱战利品爆散轨迹', () => {
  it('为每件物品生成不同落点并沿抛物线越过起点高度', () => {
    const trajectories = createLootScatterTrajectories(
      3,
      Uint32Array.of(0x78431),
      0,
      4,
      1.1,
      2,
    );
    const targets = new Set(trajectories.map((plan) => `${plan.targetX}:${plan.targetZ}`));
    expect(targets.size).toBe(3);
    expect(new Set(trajectories.map((plan) => plan.liftHeight)).size).toBe(3);
    expect(new Set(trajectories.map((plan) => Math.hypot(
      plan.targetX - plan.startX,
      plan.targetZ - plan.startZ,
    ).toFixed(4))).size).toBe(3);

    const first = trajectories[0];
    if (first === undefined) {
      throw new Error('测试轨迹不存在。');
    }
    const pose = { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0 };
    expect(evaluateLootScatterTrajectory(
      first,
      first.delay + first.flightDuration * 0.5,
      pose,
    ))
      .toBe(LootScatterPhase.Flying);
    expect(pose.y).toBeGreaterThan(first.startY);
    const straightMidpointX = (first.startX + first.targetX) * 0.5;
    const straightMidpointZ = (first.startZ + first.targetZ) * 0.5;
    expect(Math.hypot(pose.x - straightMidpointX, pose.z - straightMidpointZ))
      .toBeGreaterThan(0.3);
  });

  it('在飞行后经过衰减触地阶段并稳定于目标位置', () => {
    const plan = createLootScatterTrajectories(
      1,
      Uint32Array.of(0x1288),
      0,
      0,
      1,
      0,
    )[0];
    if (plan === undefined) {
      throw new Error('测试轨迹不存在。');
    }
    const pose = { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0 };
    const endTime = plan.delay + plan.flightDuration + plan.settleDuration + 0.01;
    expect(evaluateLootScatterTrajectory(plan, endTime, pose)).toBe(LootScatterPhase.Landed);
    expect(pose.x).toBeCloseTo(plan.targetX);
    expect(pose.y).toBeCloseTo(plan.targetY);
    expect(pose.z).toBeCloseTo(plan.targetZ);
  });

  it('为不同开箱时刻混入独立运行时熵，而不固定复用生成清单的 seed', () => {
    const random = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.125)
      .mockReturnValueOnce(0.875);
    const first = createLootRuntimeRandomSeed(0x72b8e1);
    const second = createLootRuntimeRandomSeed(0x72b8e1);
    random.mockRestore();
    expect(first).not.toBe(second);
  });

  it('玩家替换武器只产生脚边的低矮轻抛，不复用宝箱夸张高度', () => {
    const trajectory = createPlayerDiscardTrajectory(
      Uint32Array.of(0x38a1),
      0,
      4,
      1.4,
      2,
      0.3,
    );
    const distance = Math.hypot(
      trajectory.targetX - trajectory.startX,
      trajectory.targetZ - trajectory.startZ,
    );
    expect(distance).toBeGreaterThanOrEqual(0.9);
    expect(distance).toBeLessThan(1.55);
    expect(trajectory.liftHeight).toBeLessThan(0.7);
    expect(trajectory.flightDuration).toBeLessThan(0.55);
  });
});
