import { describe, expect, it } from 'vitest';
import { prepareBattlefieldEnvironment } from '../../../assets/bundles/battlefield/environment/compilation/battlefield-environment-preparation';
import { BattlefieldEnvironmentGenerator } from '../../../assets/bundles/battlefield/environment/generation/battlefield-environment-generator';
import {
  BATTLEFIELD_ENVIRONMENT_CATALOG,
  BattlefieldEnvironmentPrototype,
} from '../../../assets/bundles/battlefield/environment/catalog/battlefield-environment-catalog';
import { BATTLEFIELD_ENVIRONMENT_LANDMARKS } from '../../../assets/bundles/battlefield/environment/model/battlefield-environment-landmarks';
import { BattlefieldEnvironmentWorldState } from '../../../assets/bundles/battlefield/environment/model/battlefield-environment-state';
import {
  BATTLEFIELD_MONSTER_SPAWN,
  createBattlefieldMonsterSpawn,
} from '../../../assets/bundles/battlefield/model/battlefield-monster-spawn';

const PREPARED_ENVIRONMENT = prepareBattlefieldEnvironment();

describe('战场无限环境生成', () => {
  it('在起始窗口生成全部环境原型并保留固定展示地标', () => {
    const world = new BattlefieldEnvironmentWorldState();
    new BattlefieldEnvironmentGenerator().populate(0, 0, world);

    for (const definition of BATTLEFIELD_ENVIRONMENT_CATALOG) {
      expect(world.get(definition.prototype).enabledCount).toBeGreaterThan(0);
    }
    const activeVertexCount = PREPARED_ENVIRONMENT.prototypes.reduce(
      (total, prepared) => total
        + world.get(prepared.definition.prototype).enabledCount
        * prepared.plan.vertexCount,
      0,
    );
    expect(activeVertexCount).toBeLessThan(500_000);
    const allocatedVertexCount = PREPARED_ENVIRONMENT.prototypes.reduce(
      (total, prepared) => total
        + prepared.definition.capacity * prepared.plan.vertexCount,
      0,
    );
    expect(allocatedVertexCount).toBeLessThan(600_000);
    const altar = world.get(BattlefieldEnvironmentPrototype.RitualAltar);
    expect(altar.data.transform.x[0]).toBeCloseTo(BATTLEFIELD_ENVIRONMENT_LANDMARKS.ritualAltar.x);
    expect(altar.data.transform.z[0]).toBeCloseTo(BATTLEFIELD_ENVIRONMENT_LANDMARKS.ritualAltar.z);
    expect(BATTLEFIELD_MONSTER_SPAWN.minimumCount).toBeGreaterThan(0);
    expect(BATTLEFIELD_MONSTER_SPAWN.groundOffsetY).toBeGreaterThan(0);
  });

  it('怪物不依赖环境设施并按 Chunk 坐标确定性随机生成', () => {
    const origin = createBattlefieldMonsterSpawn({ x: 0, z: 0 });
    expect(origin).not.toBeNull();
    expect(createBattlefieldMonsterSpawn({ x: 0, z: 0 })).toEqual(origin);
    expect(origin?.count ?? 0).toBeGreaterThanOrEqual(BATTLEFIELD_MONSTER_SPAWN.minimumCount);
    expect(origin?.count ?? 0).toBeLessThan(BATTLEFIELD_MONSTER_SPAWN.maximumCountExclusive);
    expect(Math.hypot(origin?.x ?? 0, origin?.z ?? 0)).toBeGreaterThanOrEqual(11);

    const samples = Array.from({ length: 64 }, (_, index) => createBattlefieldMonsterSpawn({
      x: index - 32,
      z: index % 9 - 4,
    })).filter((spawn) => spawn !== null);
    expect(samples.length).toBeGreaterThan(4);
    expect(new Set(samples.map((spawn) => `${spawn.x.toFixed(3)}/${spawn.z.toFixed(3)}`)).size)
      .toBe(samples.length);
  });

  it('相同 Chunk 窗口重复生成完全一致并能安全生成远处窗口', () => {
    const generator = new BattlefieldEnvironmentGenerator();
    const world = new BattlefieldEnvironmentWorldState();
    generator.populate(3, -2, world);
    const first = snapshotWorld(world);
    generator.populate(3, -2, world);
    expect(snapshotWorld(world)).toEqual(first);

    generator.populate(24, -31, world);
    for (const definition of BATTLEFIELD_ENVIRONMENT_CATALOG) {
      const state = world.get(definition.prototype);
      expect(state.enabledCount).toBeLessThanOrEqual(state.count);
    }
  });

  it('在一组正负远距离窗口中不会超过任何 Archetype 固定容量', () => {
    const generator = new BattlefieldEnvironmentGenerator();
    const world = new BattlefieldEnvironmentWorldState();
    for (let chunkZ = -18; chunkZ <= 18; chunkZ += 3) {
      for (let chunkX = -18; chunkX <= 18; chunkX += 3) {
        generator.populate(chunkX, chunkZ, world);
        for (const definition of BATTLEFIELD_ENVIRONMENT_CATALOG) {
          const state = world.get(definition.prototype);
          expect(state.enabledCount).toBeLessThanOrEqual(state.count);
        }
      }
    }
  });
});

function snapshotWorld(world: BattlefieldEnvironmentWorldState): readonly number[][] {
  return BATTLEFIELD_ENVIRONMENT_CATALOG.map((definition) => {
    const state = world.get(definition.prototype);
    const values: number[] = [state.enabledCount];
    for (let index = 0; index < state.enabledCount; index++) {
      values.push(
        state.data.transform.x[index] ?? 0,
        state.data.transform.z[index] ?? 0,
        state.data.transform.heading[index] ?? 0,
        state.data.transform.scale[index] ?? 0,
      );
    }
    return values;
  });
}
