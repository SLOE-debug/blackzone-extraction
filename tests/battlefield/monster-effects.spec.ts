import { describe, expect, it } from 'vitest';
import { PlanarKnockbackCombineMode } from '../../assets/core/contracts/monster-effects';
import { BattlefieldMonsterEffectRuntime } from '../../assets/bundles/battlefield/combat/effects/battlefield-monster-effect-runtime';
import { BATTLEFIELD_MONSTER_SPAWN } from '../../assets/bundles/battlefield/model/battlefield-monster-spawn';
import {
  type PlanarCrowdCollisionSource,
  PlanarCrowdSeparationSystem,
} from '../../assets/core/monsters/crowd/planar-crowd-separation-system';
import { type PlanarCrowdCandidateBuffer } from '../../assets/core/monsters/crowd/planar-crowd-candidate-buffer';
import { calculateSpinPulseDamageScale } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-impact-profile';
import { SLEDGEHAMMER_PROGRESSION } from '../../assets/bundles/battlefield/equipment/items/sledgehammer/sledgehammer-progression';
import { ALL_BATTLEFIELD_MONSTER_IDS, BattlefieldMonsterId } from '../../assets/bundles/battlefield/model/battlefield-monster-id';
import { BATTLEFIELD_MONSTER_LAUNCH_RESPONSES } from '../../assets/bundles/battlefield/model/battlefield-monster-launch-responses';
import {
  createKineticTestKnockback as createKnockback,
  createMonsterEffectRuntime as createEffects,
  createMonsterEffectTestGroup as createGroup,
} from './monster-effects-test-fixture';

describe('怪物通用受力 Effect', () => {
  it('同一攻击序列对同一实体只接受一次', () => {
    const group = createGroup(1, [0]);
    const { effects } = createEffects(20, group);
    expect(effects.acceptHitSequence(1, 0, 17)).toBe(true);
    expect(effects.acceptHitSequence(1, 0, 17)).toBe(false);
    expect(effects.acceptHitSequence(1, 0, 18)).toBe(true);
  });

  it('击退推进平面位置且腾空高度最终回落到零', () => {
    const group = createGroup(2, [0]);
    const { effects } = createEffects(20, group);
    effects.applyKnockback(2, 0, {
      directionX: 1,
      directionZ: 0,
      initialSpeed: 8,
      remainingSeconds: 0.2,
      resistanceScale: 1,
      combineMode: PlanarKnockbackCombineMode.Replace,
      maximumSpeed: 8,
    });
    effects.applyVerticalLaunch(2, 0, {
      initialVelocity: 5,
      gravityScale: 1,
      resistanceScale: 1,
    });
    effects.update(0.05);
    expect(group.crowdPopulation.x[0]).toBeGreaterThan(0);
    expect(group.elevations[0]).toBeGreaterThan(0);
    expect(group.airborne[0]).toBe(1);
    for (let frame = 0; frame < 30; frame++) {
      effects.update(0.05);
    }
    expect(group.elevations[0]).toBe(0);
    expect(group.airborne[0]).toBe(0);
  });

  it('方向腾空同时推进水平两轴并在落地时停止飞行', () => {
    const group = createGroup(4, [0]);
    const { effects } = createEffects(20, group);
    effects.applyDirectionalLaunch(4, 0, {
      directionX: Math.SQRT1_2,
      directionZ: Math.SQRT1_2,
      targetHeight: 1.6,
      horizontalSpeed: 9.2,
      horizontalDrag: 1.15,
      gravityScale: 1,
      landingDamageBase: 0,
    });
    effects.update(0.05);
    expect(group.crowdPopulation.x[0]).toBeGreaterThan(0);
    expect(group.crowdPopulation.y[0]).toBeLessThan(0);
    expect(group.elevations[0]).toBeGreaterThan(0);
    for (let frame = 0; frame < 40; frame++) {
      effects.update(0.05);
    }
    expect(group.airborne[0]).toBe(0);
  });

  it('旋风击退按速度向量累积、改变方向并受最大速度限制', () => {
    const group = createGroup(5, [0]);
    const { effects } = createEffects(20, group);
    const apply = (directionX: number, directionZ: number, initialSpeed = 5): void => {
      effects.applyKnockback(5, 0, {
        directionX,
        directionZ,
        initialSpeed,
        remainingSeconds: 1,
        resistanceScale: 1,
        combineMode: PlanarKnockbackCombineMode.Accumulate,
        maximumSpeed: 12,
      });
    };
    apply(1, 0);
    effects.update(0.01);
    const firstDistance = group.crowdPopulation.x[0] ?? 0;
    apply(1, 0);
    effects.update(0.01);
    const secondDistance = (group.crowdPopulation.x[0] ?? 0) - firstDistance;
    expect(secondDistance).toBeGreaterThan(firstDistance);
    apply(0, 1);
    effects.update(0.01);
    expect(group.crowdPopulation.y[0]).toBeLessThan(0);
    const beforeCap = group.crowdPopulation.x[0] ?? 0;
    apply(1, 0, 50);
    effects.update(0.01);
    expect((group.crowdPopulation.x[0] ?? 0) - beforeCap).toBeLessThanOrEqual(
      12 * 0.01 / BATTLEFIELD_MONSTER_SPAWN.modelScale,
    );
  });

  it('反方向累积击退先抵消当前速度而不是沿旧方向提速', () => {
    const group = createGroup(6, [0]);
    const { effects } = createEffects(20, group);
    const common = {
      initialSpeed: 5,
      remainingSeconds: 1,
      resistanceScale: 1,
      combineMode: PlanarKnockbackCombineMode.Accumulate,
      maximumSpeed: 12,
    } as const;
    effects.applyKnockback(6, 0, { ...common, directionX: 1, directionZ: 0 });
    effects.applyKnockback(6, 0, { ...common, directionX: -1, directionZ: 0 });
    effects.update(0.05);
    expect(group.crowdPopulation.x[0]).toBeCloseTo(0, 6);
  });

  it('旋风直接命中的载体可以把未命中的外层怪物撞开', () => {
    const group = createGroup(3, [0, 1.2]);
    const { effects, crowd } = createEffects(20, group);
    effects.applyKnockback(3, 0, createKnockback(20));
    effects.applyKineticCarrier(3, 0, 9, 100, 90);
    effects.update(0.01);
    crowd.rebuild();
    const targetStart = group.crowdPopulation.x[1] ?? 0;
    effects.update(0.01);
    expect(group.crowdPopulation.x[1]).toBeGreaterThan(targetStart);
    expect(group.damageEvents.map((event) => event.entityId)).toContain(1);
  });

  it('所有已登记普通怪物都显式支持方向腾空，Venom 峰值高度清晰可见', () => {
    for (const monsterId of ALL_BATTLEFIELD_MONSTER_IDS) {
      expect(BATTLEFIELD_MONSTER_LAUNCH_RESPONSES[monsterId].launchable).toBe(true);
    }
    const venomResponse = BATTLEFIELD_MONSTER_LAUNCH_RESPONSES[
      BattlefieldMonsterId.VenomLobber
    ];
    const group = createGroup(10, [0], venomResponse);
    const { effects } = createEffects(20, group);
    effects.applyDirectionalLaunch(10, 0, {
      directionX: 1,
      directionZ: 0,
      targetHeight: 4.2,
      horizontalSpeed: 9.2,
      horizontalDrag: 1.15,
      gravityScale: 1,
      landingDamageBase: 0,
    });
    let peak = 0;
    for (let frame = 0; frame < 80; frame++) {
      effects.update(0.025);
      peak = Math.max(peak, group.elevations[0] ?? 0);
    }
    expect(peak).toBeGreaterThanOrEqual(2.4);
    expect(group.crowdPopulation.x[0]).toBeGreaterThan(0);
    expect(group.airborne[0]).toBe(0);
  });

  it('旋风重复命中逐次增伤并在新技能序列重置', () => {
    const group = createGroup(9, [0]);
    const { effects } = createEffects(20, group);
    let totalScale = 0;
    for (let hit = 1; hit <= 7; hit++) {
      const recordedHit = effects.recordSpinHit(9, 0, 21);
      expect(recordedHit).toBe(hit);
      totalScale += calculateSpinPulseDamageScale(recordedHit);
    }
    totalScale += SLEDGEHAMMER_PROGRESSION.spinFinalDamageScale;
    expect(totalScale).toBeCloseTo(5.07, 6);
    expect(effects.recordSpinHit(9, 0, 22)).toBe(1);
  });

  it('新载体从下一帧继续把动量传播给第三层目标', () => {
    const group = createGroup(7, [0, 1.2, 3]);
    const { effects, crowd } = createEffects(20, group);
    effects.applyKnockback(7, 0, createKnockback(20));
    effects.applyKineticCarrier(7, 0, 12, 100, 90);
    effects.update(0.01);
    expect(group.crowdPopulation.x[2]).toBeCloseTo(3, 6);
    crowd.rebuild();
    effects.update(0.02);
    crowd.rebuild();
    const thirdStart = group.crowdPopulation.x[2] ?? 0;
    effects.update(0.02);
    expect(group.crowdPopulation.x[2]).toBeGreaterThan(thirdStart);
  });

  it('碰撞总伤害不超过来源预算且速度传播不被固定值覆盖', () => {
    const group = createGroup(8, [0, 1.1, 1.7, 2.3]);
    const { effects } = createEffects(20, group);
    effects.applyKnockback(8, 0, createKnockback(20));
    effects.applyKineticCarrier(8, 0, 15, 100, 30);
    effects.update(0.02);
    const totalCollisionDamage = group.damageEvents.reduce(
      (total, event) => total + event.amount,
      0,
    );
    expect(totalCollisionDamage).toBeLessThanOrEqual(30);
    const retainedDisplacement = group.crowdPopulation.x[0] ?? 0;
    effects.update(0.01);
    expect((group.crowdPopulation.x[0] ?? 0) - retainedDisplacement).toBeGreaterThan(
      6.5 * 0.01 / BATTLEFIELD_MONSTER_SPAWN.modelScale,
    );
  });

  it('五百只怪与一百二十八个载体只执行局部 Crowd 候选查询', () => {
    const positions = Array.from({ length: 500 }, (_, index) => index * 20);
    const group = createGroup(11, positions);
    const crowd = new PlanarCrowdSeparationSystem();
    crowd.register(group.crowdPopulation);
    crowd.rebuild();
    const collisionSource = new TrackingCollisionSource(crowd);
    const effects = new BattlefieldMonsterEffectRuntime(20, collisionSource);
    effects.register(group);
    for (let entityId = 0; entityId < 128; entityId++) {
      effects.applyKnockback(11, entityId, createKnockback(10));
      effects.applyKineticCarrier(11, entityId, 30, 100, 90);
    }
    effects.update(0.01);
    expect(collisionSource.segmentQueryCount).toBe(128);
    expect(collisionSource.maximumCandidateCount).toBeLessThan(500);
  });
});

class TrackingCollisionSource implements PlanarCrowdCollisionSource {
  public segmentQueryCount = 0;
  public maximumCandidateCount = 0;

  constructor(private readonly crowd: PlanarCrowdSeparationSystem) {}

  public collectSegmentCandidates(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    queryRadius: number,
    result: PlanarCrowdCandidateBuffer,
  ): number {
    this.segmentQueryCount++;
    const count = this.crowd.collectSegmentCandidates(
      startX,
      startY,
      endX,
      endY,
      queryRadius,
      result,
    );
    this.maximumCandidateCount = Math.max(this.maximumCandidateCount, count);
    return count;
  }

  public collectCircleCandidates(
    centerX: number,
    centerY: number,
    radius: number,
    result: PlanarCrowdCandidateBuffer,
  ): number {
    return this.crowd.collectCircleCandidates(centerX, centerY, radius, result);
  }
}
