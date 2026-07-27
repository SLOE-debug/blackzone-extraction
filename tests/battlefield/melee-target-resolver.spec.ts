import { describe, expect, it } from 'vitest';
import {
  BattlefieldMeleeTargetResolver,
  type MutableBattlefieldMeleeAim,
} from '../../assets/bundles/battlefield/combat/battlefield-melee-target-resolver';
import {
  type BattlefieldMeleeTargetQuery,
  type BattlefieldMeleeTargetSource,
  type MutableBattlefieldMeleeTarget,
} from '../../assets/bundles/battlefield/population/battlefield-monster-target-registry';

describe('近战自动目标与方向回退', () => {
  it('有左摇杆输入时只在移动方向左右七十度内选择目标', () => {
    const resolver = new BattlefieldMeleeTargetResolver();
    const targets = new FakeTargetSource([
      { populationId: 2, entityId: 7, x: 0, z: -1 },
      { populationId: 2, entityId: 8, x: 1, z: 3 },
    ]);
    const aim = createAim();
    resolver.writeAim(targets, 0, 0, 5, 0, 1, 0, null, aim);
    expect(aim.targeted).toBe(true);
    expect(aim.entityId).toBe(8);
    expect(aim.directionX).toBeCloseTo(1 / Math.sqrt(10), 6);
    expect(aim.directionZ).toBeCloseTo(3 / Math.sqrt(10), 6);
  });

  it('距离相近时通过角度权重优先选择更符合摇杆意图的目标', () => {
    const resolver = new BattlefieldMeleeTargetResolver();
    const targets = new FakeTargetSource([
      { populationId: 1, entityId: 1, x: 1.81, z: 0.85 },
      { populationId: 1, entityId: 2, x: 0, z: 3 },
    ]);
    const aim = createAim();
    resolver.writeAim(targets, 0, 0, 5, 0, 1, 0, null, aim);
    expect(aim.entityId).toBe(2);
  });

  it('无目标时依次使用当前移动、最后移动与人物朝向', () => {
    const targets = new FakeTargetSource([]);
    const resolver = new BattlefieldMeleeTargetResolver();
    const aim = createAim();
    resolver.writeAim(targets, 0, 0, 5, 0.6, 0.8, 0, null, aim);
    expect(aim.directionX).toBeCloseTo(0.6, 6);
    expect(aim.directionZ).toBeCloseTo(0.8, 6);
    resolver.observeMovement(-1, 0);
    resolver.writeAim(targets, 0, 0, 5, 0, 0, 0, null, aim);
    expect(aim.directionX).toBeCloseTo(-1, 6);
    expect(aim.directionZ).toBeCloseTo(0, 6);

    const withoutHistory = new BattlefieldMeleeTargetResolver();
    withoutHistory.writeAim(targets, 0, 0, 5, 0, 0, Math.PI * 0.5, null, aim);
    expect(aim.directionX).toBeCloseTo(1, 6);
    expect(aim.directionZ).toBeCloseTo(0, 6);
  });

  it('持续攻击保留前方原目标并把每击方向修正限制在四十度', () => {
    const sourceTargets = [
      { populationId: 1, entityId: 3, x: 0, z: 2 },
      { populationId: 1, entityId: 4, x: 1, z: 3 },
    ];
    const targets = new FakeTargetSource(sourceTargets);
    const resolver = new BattlefieldMeleeTargetResolver();
    const aim = createAim();
    resolver.writeAim(targets, 0, 0, 5, 0, 1, 0, null, aim);
    expect(aim.entityId).toBe(3);

    sourceTargets[0]!.x = 5.02;
    sourceTargets[0]!.z = 2.9;
    resolver.writeAim(targets, 0, 0, 5, 0, 1, 0, 0, aim);
    expect(aim.entityId).toBe(3);
    expect(Math.atan2(aim.directionX, aim.directionZ)).toBeCloseTo(40 * Math.PI / 180, 6);
  });

  it('原目标失效后换目标最多修正七十度且不自动选择背后目标', () => {
    const sourceTargets = [{ populationId: 1, entityId: 3, x: 0, z: 2 }];
    const targets = new FakeTargetSource(sourceTargets);
    const resolver = new BattlefieldMeleeTargetResolver();
    const aim = createAim();
    resolver.writeAim(targets, 0, 0, 5, 0, 0, 0, null, aim);
    sourceTargets[0] = { populationId: 1, entityId: 4, x: 2, z: 0 };
    resolver.writeAim(targets, 0, 0, 5, 0, 0, 0, 0, aim);
    expect(aim.entityId).toBe(4);
    expect(Math.atan2(aim.directionX, aim.directionZ)).toBeCloseTo(70 * Math.PI / 180, 6);

    resolver.releaseTarget();
    sourceTargets[0] = { populationId: 1, entityId: 5, x: 0, z: -1 };
    resolver.writeAim(targets, 0, 0, 5, 0, 1, 0, null, aim);
    expect(aim.targeted).toBe(false);
    expect(aim.directionZ).toBeCloseTo(1, 6);
  });
});

interface FakeTarget {
  populationId: number;
  entityId: number;
  x: number;
  z: number;
}

class FakeTargetSource implements BattlefieldMeleeTargetSource {
  constructor(private readonly targets: FakeTarget[]) {}

  public writeBestMeleeTarget(
    query: Readonly<BattlefieldMeleeTargetQuery>,
    result: MutableBattlefieldMeleeTarget,
  ): boolean {
    let best: FakeTarget | null = null;
    let bestDistanceSquared = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    const minimumAlignment = Math.cos(query.halfArcRadians);
    for (const target of this.targets) {
      const deltaX = target.x - query.originX;
      const deltaZ = target.z - query.originZ;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      const distance = Math.sqrt(distanceSquared);
      if (distanceSquared > query.radius * query.radius || distance <= 0.000001) {
        continue;
      }
      const alignment = (deltaX * query.directionX + deltaZ * query.directionZ) / distance;
      if (alignment < minimumAlignment) {
        continue;
      }
      const preferred = target.populationId === query.preferredPopulationId
        && target.entityId === query.preferredEntityId;
      const score = distanceSquared
        + Math.acos(Math.max(-1, Math.min(1, alignment))) * query.angleWeight
        - (preferred ? query.preferredTargetBonus : 0);
      if (score < bestScore) {
        best = target;
        bestDistanceSquared = distanceSquared;
        bestScore = score;
      }
    }
    if (best === null) {
      return false;
    }
    writeTarget(result, best, bestDistanceSquared);
    return true;
  }
}

function createAim(): MutableBattlefieldMeleeAim {
  return {
    directionX: 0,
    directionZ: 1,
    targeted: false,
    populationId: -1,
    entityId: -1,
  };
}

function writeTarget(
  result: MutableBattlefieldMeleeTarget,
  target: Readonly<FakeTarget>,
  distanceSquared: number,
): void {
  result.populationId = target.populationId;
  result.entityId = target.entityId;
  result.x = target.x;
  result.z = target.z;
  result.distanceSquared = distanceSquared;
}
