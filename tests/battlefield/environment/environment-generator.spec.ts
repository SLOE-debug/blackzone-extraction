import { describe, expect, it } from 'vitest';
import { BattlefieldEnvironmentGenerator } from '../../../assets/bundles/battlefield/environment/generation/battlefield-environment-generator';
import { BATTLEFIELD_ENVIRONMENT_MESH_PLANS } from '../../../assets/bundles/battlefield/environment/geometry/battlefield-environment-mesh-plans';
import { BATTLEFIELD_ENVIRONMENT_PROTOTYPE_CONFIG } from '../../../assets/bundles/battlefield/environment/model/battlefield-environment-config';
import { BATTLEFIELD_ENVIRONMENT_LANDMARKS } from '../../../assets/bundles/battlefield/environment/model/battlefield-environment-landmarks';
import {
  BATTLEFIELD_ENVIRONMENT_PROTOTYPES,
  BattlefieldEnvironmentPrototype,
} from '../../../assets/bundles/battlefield/environment/model/battlefield-environment-prototype';
import { BattlefieldEnvironmentWorldState } from '../../../assets/bundles/battlefield/environment/model/battlefield-environment-state';
import { BATTLEFIELD_MONSTER_SPAWN } from '../../../assets/bundles/battlefield/model/battlefield-monster-spawn';

describe('战场无限环境生成', () => {
  it('在起始窗口生成全部环境原型并把主巢穴放到固定地标', () => {
    const world = new BattlefieldEnvironmentWorldState();
    new BattlefieldEnvironmentGenerator().populate(0, 0, world);

    for (const prototype of BATTLEFIELD_ENVIRONMENT_PROTOTYPES) {
      expect(world.get(prototype).enabledCount).toBeGreaterThan(0);
    }
    const activeVertexCount = BATTLEFIELD_ENVIRONMENT_PROTOTYPES.reduce(
      (total, prototype) => total
        + world.get(prototype).enabledCount
        * BATTLEFIELD_ENVIRONMENT_MESH_PLANS[prototype].vertexCount,
      0,
    );
    expect(activeVertexCount).toBeLessThan(500_000);
    const allocatedVertexCount = BATTLEFIELD_ENVIRONMENT_PROTOTYPES.reduce(
      (total, prototype) => total
        + BATTLEFIELD_ENVIRONMENT_PROTOTYPE_CONFIG[prototype].capacity
        * BATTLEFIELD_ENVIRONMENT_MESH_PLANS[prototype].vertexCount,
      0,
    );
    expect(allocatedVertexCount).toBeLessThan(600_000);
    const nest = world.get(BattlefieldEnvironmentPrototype.MonsterNest);
    expect(nest.data.transform.x[0]).toBeCloseTo(BATTLEFIELD_ENVIRONMENT_LANDMARKS.primaryNest.x);
    expect(nest.data.transform.z[0]).toBeCloseTo(BATTLEFIELD_ENVIRONMENT_LANDMARKS.primaryNest.z);
    expect(BATTLEFIELD_MONSTER_SPAWN.count).toBeGreaterThan(0);
    expect(BATTLEFIELD_MONSTER_SPAWN.groundOffsetY).toBeGreaterThan(0);
  });

  it('相同 Chunk 窗口重复生成完全一致并能安全生成远处窗口', () => {
    const generator = new BattlefieldEnvironmentGenerator();
    const world = new BattlefieldEnvironmentWorldState();
    generator.populate(3, -2, world);
    const first = snapshotWorld(world);
    generator.populate(3, -2, world);
    expect(snapshotWorld(world)).toEqual(first);

    generator.populate(24, -31, world);
    for (const prototype of BATTLEFIELD_ENVIRONMENT_PROTOTYPES) {
      const state = world.get(prototype);
      expect(state.enabledCount).toBeLessThanOrEqual(state.count);
    }
  });

  it('在一组正负远距离窗口中不会超过任何 Archetype 固定容量', () => {
    const generator = new BattlefieldEnvironmentGenerator();
    const world = new BattlefieldEnvironmentWorldState();
    for (let chunkZ = -18; chunkZ <= 18; chunkZ += 3) {
      for (let chunkX = -18; chunkX <= 18; chunkX += 3) {
        generator.populate(chunkX, chunkZ, world);
        expect(world.get(BattlefieldEnvironmentPrototype.MonsterNest).enabledCount)
          .toBeGreaterThan(0);
        for (const prototype of BATTLEFIELD_ENVIRONMENT_PROTOTYPES) {
          const state = world.get(prototype);
          expect(state.enabledCount).toBeLessThanOrEqual(state.count);
        }
      }
    }
  });
});

function snapshotWorld(world: BattlefieldEnvironmentWorldState): readonly number[][] {
  return BATTLEFIELD_ENVIRONMENT_PROTOTYPES.map((prototype) => {
    const state = world.get(prototype);
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
