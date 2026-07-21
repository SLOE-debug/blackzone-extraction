import { Node } from 'cc';
import { type ChunkWindowTransition } from '../../../../core/world/chunk-window-tracker';
import {
  DynamicMeshBatch,
  type DynamicMeshBatchOptions,
} from '../../../../core/rendering/dynamic-mesh-batch';
import { type PreparedBattlefieldEnvironment } from '../compilation/battlefield-environment-preparation';
import { BattlefieldEnvironmentWindowGeometryBuilder } from '../geometry/battlefield-environment-window-geometry';
import { BattlefieldEnvironmentWorldState } from '../model/battlefield-environment-state';
import { BattlefieldEnvironmentMaterials } from './battlefield-environment-materials';

const ENVIRONMENT_SURFACE_OPTIONS: DynamicMeshBatchOptions = Object.freeze({
  castShadows: false,
  receiveShadows: false,
});

/** 每帧处理有限实体，完成后再用一次 GPU 资源交换提交整个活动窗口。 */
const WINDOW_BUILD_ENTITY_BUDGET = 12;

/**
 * 把完整活动环境窗口压入单一静态 Unlit 批次。
 *
 * Chunk 变化时继续分帧写 CPU 顶点，完成前保留旧批次；最终只交换一个
 * MeshRenderer，从根源上消除活动窗口按 Chunk 放大的 Draw Call。
 */
export class BattlefieldEnvironmentRenderer {
  private readonly materials = new BattlefieldEnvironmentMaterials();
  private batch: DynamicMeshBatch | null = null;
  private pendingBuilder: BattlefieldEnvironmentWindowGeometryBuilder | null = null;
  private disposed = false;

  /** 是否仍在分帧构建下一份活动窗口统一几何。 */
  public get synchronizing(): boolean {
    return this.pendingBuilder !== null;
  }

  /** 活动环境无论包含多少 Chunk，最多只占一个三维 Draw Call。 */
  public get activeBatchCount(): number {
    return this.batch === null ? 0 : 1;
  }

  constructor(
    private readonly parent: Node,
    private readonly world: BattlefieldEnvironmentWorldState,
    private readonly preparation: PreparedBattlefieldEnvironment,
    initialTransition: Readonly<ChunkWindowTransition>,
  ) {
    this.requestSynchronization(initialTransition);
  }

  /** 窗口变化时废弃未完成快照，并针对最新世界状态重新开始统一构建。 */
  public requestSynchronization(_transition: Readonly<ChunkWindowTransition>): void {
    this.ensureActive();
    this.pendingBuilder = new BattlefieldEnvironmentWindowGeometryBuilder(
      this.world,
      this.preparation.prototypes,
    );
  }

  /** 推进固定实体预算；完成时用单批 Mesh 原子替换旧窗口。 */
  public updateSynchronization(): void {
    this.ensureActive();
    const builder = this.pendingBuilder;
    if (builder === null || !builder.writeNextEntities(WINDOW_BUILD_ENTITY_BUDGET)) {
      return;
    }
    const result = builder.finish();
    const nextBatch = new DynamicMeshBatch();
    try {
      nextBatch.initialize(
        this.parent,
        'BattlefieldEnvironmentWindow',
        result.geometry,
        this.materials.unified,
        result.bounds,
        ENVIRONMENT_SURFACE_OPTIONS,
      );
    } catch (error: unknown) {
      nextBatch.dispose();
      throw error;
    }
    const previousBatch = this.batch;
    this.batch = nextBatch;
    this.pendingBuilder = null;
    previousBatch?.dispose();
  }

  /** 场景激活前完成首份统一批次，不把初始化成本泄漏到开场帧。 */
  public completeInitialSynchronization(): void {
    this.ensureActive();
    while (this.pendingBuilder !== null) {
      this.updateSynchronization();
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.pendingBuilder = null;
    this.batch?.dispose();
    this.batch = null;
    this.materials.dispose();
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('战场环境 Chunk 渲染器已经释放。');
    }
  }
}
