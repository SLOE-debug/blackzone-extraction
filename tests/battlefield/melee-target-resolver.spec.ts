import { describe, expect, it } from 'vitest';
import {
  BattlefieldMeleeTargetResolver,
  type MutableBattlefieldMeleeAim,
} from '../../assets/bundles/battlefield/combat/battlefield-melee-target-resolver';
import {
  type BattlefieldMeleeTargetSource,
  type MutableBattlefieldMeleeTarget,
} from '../../assets/bundles/battlefield/population/battlefield-monster-target-registry';

describe('近战自动目标与方向回退', () => {
  it('附近目标优先于左摇杆移动方向', () => {
    const resolver = new BattlefieldMeleeTargetResolver();
    const targets = new FakeTargetSource([{ populationId: 2, entityId: 7, x: 3, z: 4 }]);
    const aim = createAim();
    resolver.observeMovement(-1, 0);
    resolver.writeAim(targets, 0, 0, 5, -1, 0, Math.PI, aim);
    expect(aim.targeted).toBe(true);
    expect(aim.populationId).toBe(2);
    expect(aim.entityId).toBe(7);
    expect(aim.directionX).toBeCloseTo(0.6, 6);
    expect(aim.directionZ).toBeCloseTo(0.8, 6);
  });

  it('无目标时依次使用当前移动、最后移动与人物朝向', () => {
    const targets = new FakeTargetSource([]);
    const resolver = new BattlefieldMeleeTargetResolver();
    const aim = createAim();
    resolver.writeAim(targets, 0, 0, 5, 0.6, 0.8, 0, aim);
    expect(aim.directionX).toBeCloseTo(0.6, 6);
    expect(aim.directionZ).toBeCloseTo(0.8, 6);
    resolver.observeMovement(-1, 0);
    resolver.writeAim(targets, 0, 0, 5, 0, 0, 0, aim);
    expect(aim.directionX).toBeCloseTo(-1, 6);
    expect(aim.directionZ).toBeCloseTo(0, 6);

    const withoutHistory = new BattlefieldMeleeTargetResolver();
    withoutHistory.writeAim(targets, 0, 0, 5, 0, 0, Math.PI * 0.5, aim);
    expect(aim.directionX).toBeCloseTo(1, 6);
    expect(aim.directionZ).toBeCloseTo(0, 6);
  });

  it('持续攻击在扩展释放半径内保留原目标，松开后才重新选择', () => {
    const sourceTargets = [
      { populationId: 1, entityId: 3, x: 2, z: 0 },
      { populationId: 1, entityId: 4, x: 3, z: 0 },
    ];
    const targets = new FakeTargetSource(sourceTargets);
    const resolver = new BattlefieldMeleeTargetResolver();
    const aim = createAim();
    resolver.writeAim(targets, 0, 0, 5, 0, 1, 0, aim);
    expect(aim.entityId).toBe(3);

    sourceTargets[0]!.x = 5.8;
    sourceTargets[1]!.x = 1;
    resolver.writeAim(targets, 0, 0, 5, 0, 1, 0, aim);
    expect(aim.entityId).toBe(3);

    resolver.releaseTarget();
    resolver.writeAim(targets, 0, 0, 5, 0, 1, 0, aim);
    expect(aim.entityId).toBe(4);
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
    originX: number,
    originZ: number,
    radius: number,
    preferredPopulationId: number,
    preferredEntityId: number,
    result: MutableBattlefieldMeleeTarget,
  ): boolean {
    let best: FakeTarget | null = null;
    let bestDistanceSquared = Number.POSITIVE_INFINITY;
    for (const target of this.targets) {
      const deltaX = target.x - originX;
      const deltaZ = target.z - originZ;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSquared > radius * radius) {
        continue;
      }
      if (target.populationId === preferredPopulationId
        && target.entityId === preferredEntityId) {
        writeTarget(result, target, distanceSquared);
        return true;
      }
      if (distanceSquared < bestDistanceSquared) {
        best = target;
        bestDistanceSquared = distanceSquared;
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
