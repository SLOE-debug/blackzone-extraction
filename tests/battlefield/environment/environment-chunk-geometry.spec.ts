import { describe, expect, it } from 'vitest';
import { VertexSemantic } from '../../../assets/core/mesh/vertex-layout';
import { ChunkWindowTracker } from '../../../assets/core/world/chunk-window-tracker';
import { prepareBattlefieldEnvironment } from '../../../assets/bundles/battlefield/environment/compilation/battlefield-environment-preparation';
import { BattlefieldEnvironmentGenerator } from '../../../assets/bundles/battlefield/environment/generation/battlefield-environment-generator';
import { createBattlefieldEnvironmentChunkGeometry } from '../../../assets/bundles/battlefield/environment/geometry/battlefield-environment-chunk-geometry';
import { BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG } from '../../../assets/bundles/battlefield/environment/model/battlefield-environment-config';
import { BattlefieldEnvironmentWorldState } from '../../../assets/bundles/battlefield/environment/model/battlefield-environment-state';

describe('战场环境 Chunk 裁剪几何', () => {
  it('按 5×5 Chunk 紧凑拆分全部活动实体且不创建 Normal 流', () => {
    const preparation = prepareBattlefieldEnvironment();
    const world = new BattlefieldEnvironmentWorldState();
    new BattlefieldEnvironmentGenerator().populate(0, 0, world);
    const transition = new ChunkWindowTracker(
      BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.activeChunkRadius,
    ).synchronize(0, 0);

    let expectedEntityCount = 0;
    world.forEach((_prototype, state) => {
      expectedEntityCount += state.enabledCount;
    });
    let actualEntityCount = 0;
    let renderedChunkCount = 0;
    for (const chunk of transition.added) {
      const result = createBattlefieldEnvironmentChunkGeometry(
        world,
        preparation.prototypes,
        chunk,
      );
      if (result === null) {
        continue;
      }
      renderedChunkCount++;
      actualEntityCount += result.entityCount;
      expect(result.geometry.layout.semantics).toEqual([
        VertexSemantic.Position,
        VertexSemantic.Color,
      ]);
      expect(result.geometry.vertexCount).toBeGreaterThan(0);
      expect(result.geometry.indexCount).toBeGreaterThan(0);
      expect(findMaximumIndex(result.geometry.getIndexView())).toBeLessThan(
        result.geometry.vertexCount,
      );
    }
    expect(renderedChunkCount).toBeGreaterThan(1);
    expect(renderedChunkCount).toBeLessThanOrEqual(transition.added.length);
    expect(actualEntityCount).toBe(expectedEntityCount);
  });
});

function findMaximumIndex(indices: Uint16Array | Uint32Array): number {
  let maximum = 0;
  for (const index of indices) {
    maximum = Math.max(maximum, index);
  }
  return maximum;
}
