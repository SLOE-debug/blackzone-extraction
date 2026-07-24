import { describe, expect, it } from 'vitest';
import { BATTLEFIELD_EQUIPMENT_LIBRARY } from '../../assets/bundles/battlefield/equipment/catalog/battlefield-equipment-catalog';
import { EquipmentId } from '../../assets/bundles/battlefield/equipment/catalog/equipment-id';
import { BATTLEFIELD_MONSTER_SPAWN } from '../../assets/bundles/battlefield/model/battlefield-monster-spawn';
import {
  type MutableBattlefieldAimRayContact,
  type MutableBattlefieldProjectileHit,
} from '../../assets/bundles/battlefield/population/battlefield-monster-contracts';
import { type BattlefieldMonsterTargetGroup } from '../../assets/bundles/battlefield/population/battlefield-monster-target-group';
import { BattlefieldMonsterTargetRegistry } from '../../assets/bundles/battlefield/population/battlefield-monster-target-registry';
import { BattlefieldWeaponWorldSystem } from '../../assets/bundles/battlefield/world/systems/battlefield-weapon-world-system';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { findSweptSphereBoxContact } from '../../assets/core/geometry/swept-volume-collision';
import { type PlanarCrowdPopulation } from '../../assets/core/monsters/crowd/planar-crowd-population';
import { PlanarCrowdSeparationSystem } from '../../assets/core/monsters/crowd/planar-crowd-separation-system';

const WORLD_SCALE = BATTLEFIELD_MONSTER_SPAWN.modelScale;

describe('战场枪口纵向目标解析', () => {
  it('玩家请求开火但枪口射线没有目标时不向武器运行时提交射击', () => {
    let submittedIntent: unknown = '尚未调用';
    let submittedMuzzle: unknown = '尚未调用';
    const world = createWeaponSystemWorld(false, (intent, muzzle) => {
      submittedIntent = intent;
      submittedMuzzle = muzzle;
    });

    new BattlefieldWeaponWorldSystem().update(world as never, 1 / 60);

    expect(submittedIntent).toBeNull();
    expect(submittedMuzzle).toBeNull();
  });

  it('M4A1 使用自身二十五单位射程取得二十单位外的怪物高度', () => {
    const m4a1 = BATTLEFIELD_EQUIPMENT_LIBRARY.get(EquipmentId.M4A1);
    const fixture = createRegistry([
      { x: 20, z: 0, elevation: 0.8, halfExtent: 0.7 },
    ]);
    const result = { x: 0, y: 0, z: 0 };

    const found = fixture.registry.resolveElevationAlongSegment(
      0,
      0,
      1,
      0,
      m4a1.projectile.maximumRange,
      result,
    );

    expect(m4a1.projectile.maximumRange).toBe(25);
    expect(found).toBe(true);
    expect(result).toEqual({ x: 20, y: 0.8, z: 0 });
  });

  it('候选很多但手动射线不经过轮廓时保留无纵向目标结果', () => {
    const fixture = createRegistry(Array.from({ length: 24 }, (_, index) => ({
      x: 3 + index * 0.7,
      z: 3 + index % 3,
      elevation: 1,
      halfExtent: 0.4,
    })));

    expect(fixture.registry.resolveElevationAlongSegment(
      0,
      0,
      1,
      0,
      25,
      { x: 0, y: 0, z: 0 },
    )).toBe(false);
  });

  it('近端目标稍偏而远端中心对齐时按首次接触选择近端目标', () => {
    const fixture = createRegistry([
      { x: 7, z: 0.45, elevation: 0.65, halfExtent: 0.8 },
      { x: 16, z: 0, elevation: 1.8, halfExtent: 0.5 },
    ]);
    const result = { x: 0, y: 0, z: 0 };

    expect(fixture.registry.resolveElevationAlongSegment(
      0,
      0,
      1,
      0,
      25,
      result,
    )).toBe(true);
    expect(result).toEqual({ x: 7, y: 0.65, z: 0.45 });
  });
});

function createWeaponSystemWorld(
  targetFound: boolean,
  onUpdateFiring: (intent: unknown, muzzle: unknown) => void,
) {
  const performance = {
    beginStage: () => 0,
    endStage() {},
    recordEvent() {},
  };
  return {
    weaponOwnerPose: {
      rootX: 0,
      rootY: 2,
      rootZ: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      rotationW: 1,
      forwardX: 0,
      forwardY: 0,
      forwardZ: 1,
      alive: true,
    },
    weaponFireDirection: { directionX: 1, directionZ: 0 },
    weaponFireIntent: {
      directionX: 0,
      directionZ: 1,
      elevationTarget: { x: 0, y: 0, z: 0 },
    },
    weaponFiringRequested: true,
    resources: {
      performance,
      player: {
        isAlive: true,
        writeWeaponRigPose() {},
      },
      monsters: {
        resolveElevationAlongSegment(
          _originX: number,
          _originZ: number,
          _directionX: number,
          _directionZ: number,
          _maximumDistance: number,
          result: { x: number; y: number; z: number },
        ) {
          if (targetFound) {
            result.x = 8;
            result.y = 1;
            result.z = 0;
          }
          return targetFound;
        },
      },
      weapon: {
        projectileMaximumRange: 25,
        projectileStatistics: { projectilesSpawned: 0 },
        beginProjectileFrame() {},
        writeMuzzlePose(
          _owner: unknown,
          result: { muzzleX: number; muzzleY: number; muzzleZ: number },
        ) {
          result.muzzleX = 0.978;
          result.muzzleY = 2.5;
          result.muzzleZ = 0;
          return true;
        },
        updateFiring(
          _deltaTime: number,
          _owner: unknown,
          intent: unknown,
          muzzle: unknown,
        ) {
          onUpdateFiring(intent, muzzle);
        },
      },
    },
  };
}

interface TestAimTarget {
  readonly x: number;
  readonly z: number;
  readonly elevation: number;
  readonly halfExtent: number;
}

function createRegistry(targets: readonly TestAimTarget[]) {
  const group = new TestAimTargetGroup(19, targets);
  const crowd = new PlanarCrowdSeparationSystem();
  crowd.register(group.crowdPopulation);
  crowd.rebuild();
  const registry = new BattlefieldMonsterTargetRegistry(crowd);
  registry.register(group);
  return { registry };
}

class TestAimTargetGroup implements BattlefieldMonsterTargetGroup {
  public readonly crowdPopulation: PlanarCrowdPopulation;

  constructor(
    public readonly populationId: number,
    private readonly targets: readonly TestAimTarget[],
  ) {
    const count = targets.length;
    const x = new Float32Array(count);
    const y = new Float32Array(count);
    const radius = new Float32Array(count);
    for (let index = 0; index < count; index++) {
      const target = targets[index];
      if (target === undefined) {
        continue;
      }
      x[index] = target.x / WORLD_SCALE;
      y[index] = -target.z / WORLD_SCALE;
      radius[index] = target.halfExtent / WORLD_SCALE;
    }
    this.crowdPopulation = Object.freeze({
      populationId,
      count,
      lifecycle: new Uint8Array(count).fill(MonsterLifecycleState.Alive),
      previousX: x,
      previousY: y,
      x,
      y,
      radius,
      inverseMass: new Float32Array(count).fill(1),
    });
  }

  public writeAimRayContactForEntity(
    entityIndex: number,
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
    result: MutableBattlefieldAimRayContact,
  ): boolean {
    const target = this.targets[entityIndex];
    if (target === undefined) {
      return false;
    }
    const progress = findSweptSphereBoxContact(
      startX - target.x,
      startZ - target.z,
      0,
      endX - target.x,
      endZ - target.z,
      0,
      target.halfExtent,
      target.halfExtent,
      0,
      0,
    );
    if (progress === null) {
      return false;
    }
    result.x = target.x;
    result.y = target.elevation;
    result.z = target.z;
    result.segmentProgress = progress;
    return true;
  }

  public writeProjectileHitForEntity(
    _entityIndex: number,
    _startX: number,
    _startY: number,
    _startZ: number,
    _endX: number,
    _endY: number,
    _endZ: number,
    _impactRadius: number,
    _result: MutableBattlefieldProjectileHit,
  ): boolean {
    return false;
  }

  public damageMonster(): void {}
}
