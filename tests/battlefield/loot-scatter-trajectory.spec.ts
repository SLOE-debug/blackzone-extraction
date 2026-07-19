import { describe, expect, it } from 'vitest';
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

    const first = trajectories[0];
    if (first === undefined) {
      throw new Error('测试轨迹不存在。');
    }
    const pose = { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0 };
    expect(evaluateLootScatterTrajectory(first, first.flightDuration * 0.5, pose))
      .toBe(LootScatterPhase.Flying);
    expect(pose.y).toBeGreaterThan(first.startY);
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
});
