import { Node } from 'cc';
import {
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
import { createBattlefieldEnvironmentChunkGeometry } from '../geometry/battlefield-environment-chunk-geometry';
import { BattlefieldEnvironmentWorldState } from '../model/battlefield-environment-state';
import { BattlefieldEnvironmentMaterials } from './battlefield-environment-materials';

const ENVIRONMENT_SURFACE_OPTIONS: DynamicMeshBatchOptions = Object.freeze({
  castShadows: false,
  receiveShadows: false,
});

/** 相机视锥可独立剔除的单个环境 Chunk 批次。 */
interface BattlefieldEnvironmentChunkBatch {
  readonly coordinate: Readonly<ChunkCoordinate>;
  readonly batch: DynamicMeshBatch;
}

/**
 * 按 Chunk 管理静态 Unlit 环境批次。
 *
 * 每个批次只包含该 Chunk 的真实活动实体并具有紧包围盒；相机外 Chunk 会由 Cocos
 * 原生 Model 视锥裁剪直接跳过，不再提交整个 5×5 活动窗口的大网格。
 */
export class BattlefieldEnvironmentRenderer {
  private readonly materials = new BattlefieldEnvironmentMaterials();
  private readonly batches = new Map<ChunkCoordinateKey, BattlefieldEnvironmentChunkBatch>();
  private readonly pendingChunks: Readonly<ChunkCoordinate>[] = [];
  private readonly pendingKeys = new Set<ChunkCoordinateKey>();
  private disposed = false;

  /** 是否仍有新增 Chunk 等待创建独立渲染批次。 */
  public get synchronizing(): boolean {
    return this.pendingChunks.length > 0;
  }

  /** 当前实际存在且可被相机独立裁剪的环境批次数量。 */
  public get activeBatchCount(): number {
    return this.batches.size;
  }

  constructor(
    private readonly parent: Node,
    private readonly world: BattlefieldEnvironmentWorldState,
    private readonly preparation: PreparedBattlefieldEnvironment,
    initialTransition: Readonly<ChunkWindowTransition>,
  ) {
    this.requestSynchronization(initialTransition);
  }

  /** 应用活动窗口差集：立即释放离场批次，并把新增 Chunk 排入分帧构建队列。 */
  public requestSynchronization(transition: Readonly<ChunkWindowTransition>): void {
    this.ensureActive();
    for (const coordinate of transition.removed) {
      const key = toChunkCoordinateKey(coordinate);
      const existing = this.batches.get(key);
      existing?.batch.dispose();
      this.batches.delete(key);
      this.removePending(key);
    }
    for (const coordinate of transition.added) {
      const key = toChunkCoordinateKey(coordinate);
      if (this.batches.has(key) || this.pendingKeys.has(key)) {
        continue;
      }
      this.pendingChunks.push(coordinate);
      this.pendingKeys.add(key);
    }
  }

  /** 每帧最多创建一个新增 Chunk，避免跨边界时集中构造多个 Mesh。 */
  public updateSynchronization(): void {
    this.ensureActive();
    const coordinate = this.pendingChunks.shift();
    if (coordinate === undefined) {
      return;
    }
    const key = toChunkCoordinateKey(coordinate);
    this.pendingKeys.delete(key);
    const result = createBattlefieldEnvironmentChunkGeometry(
      this.world,
      this.preparation.prototypes,
      coordinate,
    );
    if (result === null) {
      return;
    }
    const batch = new DynamicMeshBatch();
    try {
      batch.initialize(
        this.parent,
        `BattlefieldEnvironmentChunk-${coordinate.x}-${coordinate.z}`,
        result.geometry,
        this.materials.unified,
        result.geometry.computeBounds(),
        ENVIRONMENT_SURFACE_OPTIONS,
      );
      this.batches.set(key, Object.freeze({ coordinate, batch }));
    } catch (error: unknown) {
      batch.dispose();
      throw error;
    }
  }

  /** 场景激活前完成初始 5×5 Chunk 批次，不把加载成本泄漏到首帧。 */
  public completeInitialSynchronization(): void {
    this.ensureActive();
    while (this.pendingChunks.length > 0) {
      this.updateSynchronization();
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const entry of this.batches.values()) {
      entry.batch.dispose();
    }
    this.batches.clear();
    this.pendingChunks.length = 0;
    this.pendingKeys.clear();
    this.materials.dispose();
  }

  private removePending(key: ChunkCoordinateKey): void {
    if (!this.pendingKeys.delete(key)) {
      return;
    }
    for (let index = this.pendingChunks.length - 1; index >= 0; index--) {
      const coordinate = this.pendingChunks[index];
      if (coordinate !== undefined && toChunkCoordinateKey(coordinate) === key) {
        this.pendingChunks.splice(index, 1);
      }
    }
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('战场环境 Chunk 渲染器已经释放。');
    }
  }
}
