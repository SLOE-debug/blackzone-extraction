import { type ChunkCoordinate } from '../../../../core/world/chunk-coordinate';
import {
  createUnlitColorGeometry,
  GeometryIndexFormat,
  type UnlitColorBufferGeometry,
} from '../../../../core/geometry/buffer-geometry';
import { type PreparedBattlefieldEnvironmentCatalog } from './battlefield-environment-prepared-catalog';
import {
  copyBattlefieldEnvironmentEntityIndices,
  writeBattlefieldEnvironmentEntity,
} from './battlefield-environment-geometry-writer';
import {
  type BattlefieldEnvironmentArchetypeState,
  BattlefieldEnvironmentWorldState,
} from '../model/battlefield-environment-state';

/** 一个 Chunk 精确活动实体生成的紧凑 Unlit 几何。 */
export interface BattlefieldEnvironmentChunkGeometry {
  readonly geometry: UnlitColorBufferGeometry;
  readonly entityCount: number;
}

/**
 * 把指定 Chunk 的活动环境实体紧凑写入独立网格。
 *
 * 每个 Chunk 拥有独立 Renderer 与包围盒，因此 Cocos 原生视锥裁剪可以完整跳过
 * 相机外 Chunk，而不再被覆盖整个活动窗口的大包围盒拖入提交列表。
 */
export function createBattlefieldEnvironmentChunkGeometry(
  world: BattlefieldEnvironmentWorldState,
  preparedCatalog: PreparedBattlefieldEnvironmentCatalog,
  chunk: Readonly<ChunkCoordinate>,
): BattlefieldEnvironmentChunkGeometry | null {
  let entityCount = 0;
  let vertexCount = 0;
  let indexCount = 0;
  for (const prepared of preparedCatalog) {
    const state = world.get(prepared.definition.prototype);
    const count = countChunkEntities(state, chunk);
    entityCount += count;
    vertexCount += prepared.plan.vertexCount * count;
    indexCount += prepared.plan.indexCount * count;
  }
  if (entityCount === 0) {
    return null;
  }
  const indexFormat = vertexCount <= 65_535
    ? GeometryIndexFormat.Uint16
    : GeometryIndexFormat.Uint32;
  const geometry = createUnlitColorGeometry(vertexCount, indexCount, indexFormat);
  geometry.commitCounts(vertexCount, indexCount);

  let targetVertexOffset = 0;
  let targetIndexOffset = 0;
  for (const prepared of preparedCatalog) {
    const state = world.get(prepared.definition.prototype);
    const { identity, chunk: entityChunks } = state.data;
    for (let entityIndex = 0; entityIndex < state.enabledCount; entityIndex++) {
      if ((identity.active[entityIndex] ?? 0) === 0
        || (entityChunks.x[entityIndex] ?? 0) !== chunk.x
        || (entityChunks.z[entityIndex] ?? 0) !== chunk.z) {
        continue;
      }
      writeBattlefieldEnvironmentEntity(
        state,
        prepared.plan,
        entityIndex,
        geometry,
        targetVertexOffset,
      );
      copyBattlefieldEnvironmentEntityIndices(
        prepared.plan,
        geometry,
        targetVertexOffset,
        targetIndexOffset,
      );
      targetVertexOffset += prepared.plan.vertexCount;
      targetIndexOffset += prepared.plan.indexCount;
    }
  }
  if (targetVertexOffset !== vertexCount || targetIndexOffset !== indexCount) {
    throw new Error('环境 Chunk 紧凑几何写入计数与预计算结果不一致。');
  }
  return Object.freeze({ geometry, entityCount });
}

function countChunkEntities(
  state: BattlefieldEnvironmentArchetypeState,
  chunk: Readonly<ChunkCoordinate>,
): number {
  const { identity, chunk: entityChunks } = state.data;
  let count = 0;
  for (let index = 0; index < state.enabledCount; index++) {
    if ((identity.active[index] ?? 0) !== 0
      && (entityChunks.x[index] ?? 0) === chunk.x
      && (entityChunks.z[index] ?? 0) === chunk.z) {
      count++;
    }
  }
  return count;
}
