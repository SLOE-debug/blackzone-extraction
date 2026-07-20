import { describe, expect, it } from 'vitest';
import { createChunkCoordinate } from '../../assets/core/world/chunk-coordinate';
import { BattlefieldEnvironmentPlacementQuery } from '../../assets/bundles/battlefield/environment/collision/battlefield-environment-placement-query';
import { prepareBattlefieldEnvironment } from '../../assets/bundles/battlefield/environment/compilation/battlefield-environment-preparation';
import { BattlefieldEnvironmentGenerator } from '../../assets/bundles/battlefield/environment/generation/battlefield-environment-generator';
import { BattlefieldEnvironmentWorldState } from '../../assets/bundles/battlefield/environment/model/battlefield-environment-state';
import { BATTLEFIELD_TREASURE_CHEST_ENVIRONMENT_BLOCKERS } from '../../assets/bundles/battlefield/treasure-chest/model/battlefield-treasure-chest-environment';
import {
  BATTLEFIELD_TREASURE_CHEST_GENERATION,
  createBattlefieldTreasureChestSpawns,
} from '../../assets/bundles/battlefield/treasure-chest/model/battlefield-treasure-chest-spawn';

describe('战场宝箱环境避让', () => {
  it('拒绝蘑菇、发光草和岩石真实网格占地内的宝箱位置', () => {
    const preparation = prepareBattlefieldEnvironment();
    const world = new BattlefieldEnvironmentWorldState();
    new BattlefieldEnvironmentGenerator().populate(0, 0, world);
    const query = new BattlefieldEnvironmentPlacementQuery(
      world,
      preparation.prototypes,
    );
    for (const prototype of BATTLEFIELD_TREASURE_CHEST_ENVIRONMENT_BLOCKERS) {
      const state = world.get(prototype);
      expect(state.enabledCount).toBeGreaterThan(0);
      expect(query.isAreaClearOf(
        [prototype],
        state.data.transform.x[0] ?? 0,
        state.data.transform.z[0] ?? 0,
        0,
      )).toBe(false);
    }
    const placementConstraint = Object.freeze({
      isAreaClear: (x: number, z: number, clearanceRadius: number): boolean => (
        query.isAreaClearOf(
          BATTLEFIELD_TREASURE_CHEST_ENVIRONMENT_BLOCKERS,
          x,
          z,
          clearanceRadius,
        )
      ),
    });

    let generatedChestCount = 0;
    for (let chunkX = -2; chunkX <= 2; chunkX++) {
      for (let chunkZ = -2; chunkZ <= 2; chunkZ++) {
        const spawns = createBattlefieldTreasureChestSpawns(
          createChunkCoordinate(chunkX, chunkZ),
          placementConstraint,
        );
        for (const spawn of spawns) {
          expect(placementConstraint.isAreaClear(
            spawn.x,
            spawn.z,
            BATTLEFIELD_TREASURE_CHEST_GENERATION.environmentClearanceRadius,
          )).toBe(true);
        }
        generatedChestCount += spawns.length;
      }
    }
    expect(generatedChestCount).toBeGreaterThan(0);
  });
});
