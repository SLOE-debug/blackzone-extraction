import { type Material, Node } from 'cc';
import { type EntityRange } from '../entities/entity-range';
import {
  createSurfaceGeometry,
  type GeometryBounds,
  GeometryIndexFormat,
} from '../geometry/buffer-geometry';
import { MeshDirty } from '../mesh/mesh-dirty';
import { type MeshEvaluator } from '../mesh/mesh-evaluator';
import {
  assertMeshPlan,
  type MeshPlan,
} from '../mesh/mesh-plan';
import { copyMeshPlanIndices } from '../mesh/mesh-plan-indices';
import { createVertexStreams, type VertexStreams } from '../mesh/vertex-streams';
import { partitionBatches } from './batch-partition';
import {
  DynamicMeshBatch,
  type DynamicMeshBatchOptions,
} from './dynamic-mesh-batch';

/** 描述一个使用编译后单实体网格计划的渲染层。 */
export interface CompiledMeshRenderLayer<
  TState,
  TPlan extends MeshPlan,
  TLayerId extends string,
> {
  /** 领域侧识别渲染层的稳定标识。 */
  readonly id: TLayerId;
  /** 创建 Cocos 子节点时使用的名称。 */
  readonly nodeName: string;
  /** 该层动态网格使用的材质实例。 */
  readonly material: Material;
  /** 一个实体共享的固定局部拓扑计划。 */
  readonly plan: TPlan;
  /** 根据领域状态原地更新该层动态顶点流的求值器。 */
  readonly evaluator: MeshEvaluator<TState, TPlan>;
}

/** 编译式动态网格批渲染器的初始化参数。 */
export interface CompiledMeshBatchRendererOptions<
  TState,
  TPlan extends MeshPlan,
  TLayerId extends string,
> {
  /** 动态网格节点的父节点。 */
  readonly parent: Node;
  /** 各层 Evaluator 读取的领域状态或 SoA 数据表。 */
  readonly state: TState;
  /** 需要渲染的实体总数。 */
  readonly entityCount: number;
  /** 期望的单个批次实体数量，实际值会受索引格式限制。 */
  readonly requestedBatchSize: number;
  /** 动态网格索引缓冲的目标格式。 */
  readonly indexFormat: GeometryIndexFormat;
  /** 初始化时提交给每个批次的模型空间包围盒。 */
  readonly bounds: GeometryBounds;
  /** Cocos 动态网格的受光和阴影选项。 */
  readonly surfaceOptions: Readonly<DynamicMeshBatchOptions>;
  /** 需要以相同实体范围切分的编译后渲染层。 */
  readonly layers: readonly CompiledMeshRenderLayer<TState, TPlan, TLayerId>[];
}

interface CompiledMeshLayerChunk<TState, TPlan extends MeshPlan> {
  readonly plan: TPlan;
  readonly evaluator: MeshEvaluator<TState, TPlan>;
  readonly streams: VertexStreams;
  readonly batch: DynamicMeshBatch;
}

interface CompiledMeshRenderChunk<TState, TPlan extends MeshPlan> {
  readonly range: EntityRange;
  readonly layers: CompiledMeshLayerChunk<TState, TPlan>[];
}

/**
 * 管理编译后固定拓扑计划及其按需更新的动态顶点流。
 *
 * 构造阶段仅复制一次局部索引；每帧只让 Evaluator 改写请求的流，并上传实际变化的属性。
 */
export class CompiledMeshBatchRenderer<
  TState,
  TPlan extends MeshPlan,
  TLayerId extends string,
> {
  private readonly chunks: CompiledMeshRenderChunk<TState, TPlan>[] = [];
  private disposed = false;

  /**
   * 创建并初始化全部连续实体批次。
   *
   * @param options 强类型领域状态、计划和 Cocos 渲染配置。
   */
  constructor(private readonly options: CompiledMeshBatchRendererOptions<TState, TPlan, TLayerId>) {
    if (options.layers.length === 0) {
      throw new Error('编译式网格批渲染器至少需要一个渲染层。');
    }

    let maximumBatchSize = Number.MAX_SAFE_INTEGER;
    for (const layer of options.layers) {
      assertRenderablePlan(layer.plan, layer.id);
      maximumBatchSize = Math.min(
        maximumBatchSize,
        getMaximumBatchEntityCount(layer.plan, options.indexFormat),
      );
    }

    try {
      const partitions = partitionBatches(
        options.entityCount,
        options.requestedBatchSize,
        maximumBatchSize,
      );

      for (const partition of partitions) {
        const layers: CompiledMeshLayerChunk<TState, TPlan>[] = [];
        this.chunks.push({ range: partition.range, layers });

        for (const layer of options.layers) {
          const geometry = createSurfaceGeometry(
            getBatchElementCount(layer.plan.vertexCount, partition.range.count, '顶点'),
            getBatchElementCount(layer.plan.indexCount, partition.range.count, '索引'),
            options.indexFormat,
          );
          geometry.commitCounts(geometry.maxVertices, geometry.maxIndices);
          copyMeshPlanIndices(layer.plan, partition.range.count, geometry.getIndexView());

          const streams = createVertexStreams(geometry);
          layer.evaluator.evaluate(
            options.state,
            layer.plan,
            streams,
            partition.range,
            MeshDirty.All,
          );

          const batch = new DynamicMeshBatch();
          batch.initialize(
            options.parent,
            `${layer.nodeName}-${partition.index}`,
            geometry,
            layer.material,
            options.bounds,
            options.surfaceOptions,
          );
          layers.push({
            plan: layer.plan,
            evaluator: layer.evaluator,
            streams,
            batch,
          });
        }
      }
    } catch (error: unknown) {
      this.dispose();
      throw error;
    }
  }

  /**
   * 按请求重新求值动态属性，并仅上传实际发生变化的顶点流。
   *
   * @param requested 允许 Evaluator 更新的顶点流和包围盒位标志。
   * @param bounds 可选的新模型空间包围盒；仅当 Evaluator 返回 Bounds 时提交。
   * @returns 无返回值；无异常时所有活动批次均已完成所需更新。
   */
  public update(requested: MeshDirty, bounds?: GeometryBounds): void {
    if (this.disposed) {
      throw new Error('编译式网格批渲染器已经释放。');
    }
    if (requested === MeshDirty.None) {
      return;
    }

    for (const chunk of this.chunks) {
      for (const layer of chunk.layers) {
        const changed = layer.evaluator.evaluate(
          this.options.state,
          layer.plan,
          layer.streams,
          chunk.range,
          requested,
        );
        if ((changed & (MeshDirty.Position | MeshDirty.Normal | MeshDirty.Color)) !== 0) {
          layer.batch.uploadVertexAttributes(
            changed,
            layer.streams.positions.length / 3,
          );
        }
        if (bounds !== undefined && (changed & MeshDirty.Bounds) !== 0) {
          layer.batch.updateBounds(bounds);
        }
      }
    }
  }

  /** 释放所有 Cocos 动态网格批次，不销毁外部传入的材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    for (const chunk of this.chunks) {
      for (const layer of chunk.layers) {
        layer.batch.dispose();
      }
    }
    this.chunks.length = 0;
    this.disposed = true;
  }
}

/** 验证动态批渲染器可分配的单实体计划。 */
function assertRenderablePlan(plan: MeshPlan, layerId: string): void {
  assertMeshPlan(plan);
  if (plan.vertexCount <= 0 || plan.indexCount <= 0) {
    throw new Error(`渲染层 ${layerId} 的网格计划必须包含顶点和索引。`);
  }
}

/** 根据目标索引格式计算单个批次可容纳的实体上限。 */
function getMaximumBatchEntityCount(
  plan: MeshPlan,
  indexFormat: GeometryIndexFormat,
): number {
  const maximumVertexCount = indexFormat === GeometryIndexFormat.Uint16 ? 65535 : 0xffffffff;
  const entityCount = Math.floor(maximumVertexCount / plan.vertexCount);
  if (entityCount <= 0) {
    throw new Error('单实体网格计划超过目标索引格式的顶点容量。');
  }
  return entityCount;
}

/** 计算一个批次的强类型缓冲元素数量。 */
function getBatchElementCount(
  perEntityCount: number,
  entityCount: number,
  description: string,
): number {
  const total = perEntityCount * entityCount;
  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new Error(`批次${description}数量无效。`);
  }
  return total;
}
