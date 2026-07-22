import { Node } from 'cc';
import {
  createChunkCoordinate,
  toChunkCoordinateKey,
  type ChunkCoordinate,
  type ChunkCoordinateKey,
} from '../../../../core/world/chunk-coordinate';
import { type ChunkWindowTransition } from '../../../../core/world/chunk-window-tracker';
import {
  DynamicMeshBatch,
  type DynamicMeshBatchOptions,
} from '../../../../core/rendering/dynamic-mesh-batch';
import { type PreparedBattlefieldEnvironment } from '../compilation/battlefield-environment-preparation';
import {
  BattlefieldEnvironmentChunkGeometryBuilder,
} from '../geometry/battlefield-environment-chunk-geometry';
import { BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG } from '../model/battlefield-environment-config';
import { BattlefieldEnvironmentWorldState } from '../model/battlefield-environment-state';
import { BattlefieldEnvironmentMaterials } from './battlefield-environment-materials';

const ENVIRONMENT_SURFACE_OPTIONS: DynamicMeshBatchOptions = Object.freeze({
  castShadows: false,
  receiveShadows: false,
});
const CHUNK_BUILD_ENTITY_BUDGET = 12;

interface BattlefieldEnvironmentChunkSlot {
  batch: DynamicMeshBatch | null;
  chunkKey: ChunkCoordinateKey | null;
}

interface BattlefieldEnvironmentPendingChunkBuild {
  readonly slot: BattlefieldEnvironmentChunkSlot;
  readonly coordinate: Readonly<ChunkCoordinate>;
  builder: BattlefieldEnvironmentChunkGeometryBuilder | null;
}

/**
 * 复用固定数量的 Chunk 渲染槽位，只替换新进入活动窗口的边缘 Chunk。
 *
 * 每个槽位拥有独立 Mesh，持续移动时不会再为完整窗口分配和回收大块几何。
 */
export class BattlefieldEnvironmentRenderer {
  private readonly materials = new BattlefieldEnvironmentMaterials();
  private readonly slots: BattlefieldEnvironmentChunkSlot[];
  private readonly pendingBuilds: BattlefieldEnvironmentPendingChunkBuild[] = [];
  private recentGeometryBytesAllocated = 0;
  private recentBuilderReplacements = 0;
  private disposed = false;

  /** 是否仍在分帧构建新进入窗口的 Chunk。 */
  public get synchronizing(): boolean {
    return this.pendingBuilds.length > 0;
  }

  /** 当前已经完成 GPU 初始化的 Chunk 批次数。 */
  public get activeBatchCount(): number {
    let count = 0;
    for (const slot of this.slots) {
      if (slot.batch !== null) {
        count++;
      }
    }
    return count;
  }

  /** 最近一次窗口请求为新增 Chunk 分配的 CPU 几何字节数。 */
  public get geometryBytesAllocated(): number {
    return this.recentGeometryBytesAllocated;
  }

  /** 最近一次窗口请求取消的未完成 Chunk 构建器数量。 */
  public get builderReplacementCount(): number {
    return this.recentBuilderReplacements;
  }

  constructor(
    private readonly parent: Node,
    private readonly world: BattlefieldEnvironmentWorldState,
    private readonly preparation: PreparedBattlefieldEnvironment,
    initialTransition: Readonly<ChunkWindowTransition>,
  ) {
    const radius = BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.activeChunkRadius;
    const diameter = radius * 2 + 1;
    this.slots = Array.from(
      { length: diameter * diameter },
      (): BattlefieldEnvironmentChunkSlot => ({ batch: null, chunkKey: null }),
    );
    this.requestSynchronization(initialTransition);
  }

  /** 根据真实已提交槽位与目标窗口差集，只为缺失 Chunk 创建构建任务。 */
  public requestSynchronization(transition: Readonly<ChunkWindowTransition>): void {
    this.ensureActive();
    this.recentBuilderReplacements = this.pendingBuilds.length;
    this.pendingBuilds.length = 0;
    this.recentGeometryBytesAllocated = 0;

    const desiredCoordinates = createWindowCoordinates(transition.center);
    const desiredKeys = new Set(
      desiredCoordinates.map((coordinate) => toChunkCoordinateKey(coordinate)),
    );
    const availableSlots: BattlefieldEnvironmentChunkSlot[] = [];
    const retainedKeys = new Set<ChunkCoordinateKey>();
    for (const slot of this.slots) {
      if (slot.chunkKey !== null && desiredKeys.has(slot.chunkKey)) {
        retainedKeys.add(slot.chunkKey);
      } else {
        availableSlots.push(slot);
      }
    }

    let availableIndex = 0;
    for (const coordinate of desiredCoordinates) {
      const key = toChunkCoordinateKey(coordinate);
      if (retainedKeys.has(key)) {
        continue;
      }
      const slot = availableSlots[availableIndex++];
      if (slot === undefined) {
        throw new Error('环境 Chunk 固定渲染槽位不足。');
      }
      this.pendingBuilds.push({ slot, coordinate, builder: null });
    }
    if (availableIndex !== availableSlots.length) {
      throw new Error('环境 Chunk 固定渲染槽位与目标窗口数量不一致。');
    }
  }

  /** 推进一个 Chunk 的固定实体预算；完成后原子替换对应旧槽位。 */
  public updateSynchronization(): void {
    this.ensureActive();
    const pending = this.pendingBuilds[0];
    if (pending === undefined) {
      return;
    }
    if (pending.builder === null) {
      pending.builder = new BattlefieldEnvironmentChunkGeometryBuilder(
        this.world,
        this.preparation.prototypes,
        pending.coordinate.x,
        pending.coordinate.z,
      );
      this.recentGeometryBytesAllocated += pending.builder.allocatedByteLength;
    }
    const builder = pending.builder;
    if (!builder.writeNextEntities(CHUNK_BUILD_ENTITY_BUDGET)) {
      return;
    }
    const result = builder.finish();
    const nextBatch = new DynamicMeshBatch();
    try {
      nextBatch.initialize(
        this.parent,
        `BattlefieldEnvironmentChunk(${pending.coordinate.x},${pending.coordinate.z})`,
        result.geometry,
        this.materials.unified,
        result.bounds,
        ENVIRONMENT_SURFACE_OPTIONS,
      );
    } catch (error: unknown) {
      nextBatch.dispose();
      throw error;
    }
    const previousBatch = pending.slot.batch;
    pending.slot.batch = nextBatch;
    pending.slot.chunkKey = toChunkCoordinateKey(pending.coordinate);
    this.pendingBuilds.shift();
    previousBatch?.dispose();
  }

  /** 场景激活前完成首个窗口全部 Chunk，不把初始化成本泄漏到开场帧。 */
  public completeInitialSynchronization(): void {
    this.ensureActive();
    while (this.pendingBuilds.length > 0) {
      this.updateSynchronization();
    }
    this.recentGeometryBytesAllocated = 0;
    this.recentBuilderReplacements = 0;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.pendingBuilds.length = 0;
    for (const slot of this.slots) {
      slot.batch?.dispose();
      slot.batch = null;
      slot.chunkKey = null;
    }
    this.materials.dispose();
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('战场环境 Chunk 渲染器已经释放。');
    }
  }
}

function createWindowCoordinates(
  center: Readonly<ChunkCoordinate>,
): readonly Readonly<ChunkCoordinate>[] {
  const radius = BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.activeChunkRadius;
  const coordinates: Readonly<ChunkCoordinate>[] = [];
  for (let z = center.z - radius; z <= center.z + radius; z++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      coordinates.push(createChunkCoordinate(x, z));
    }
  }
  return coordinates;
}
