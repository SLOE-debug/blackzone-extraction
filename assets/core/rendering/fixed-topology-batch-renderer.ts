import { type Material, Node } from 'cc';
import {
  createPositionGeometry,
  type GeometryBounds,
  GeometryIndexFormat,
  type PositionBufferGeometry,
} from '../geometry/buffer-geometry';
import {
  type FixedTopologyGeometrySource,
  getMaximumIndexedEntityCount,
  getTopologyIndexCount,
  getTopologyVertexCount,
} from '../geometry/fixed-topology';
import { TriangleMeshWriter } from '../geometry/triangle-mesh-writer';
import { partitionBatches } from './batch-partition';
import { DynamicMeshBatch } from './dynamic-mesh-batch';

/**
 * 描述一个固定拓扑实体渲染层。
 */
export interface RenderLayerDefinition<TSource, TLayerId extends string> {
  readonly id: TLayerId;
  readonly nodeName: string;
  readonly material: Material;
  readonly geometry: FixedTopologyGeometrySource<TSource>;
}

/** 固定拓扑批渲染器初始化参数。 */
export interface FixedTopologyBatchRendererOptions<TSource, TLayerId extends string> {
  readonly parent: Node;
  readonly source: TSource;
  readonly entityCount: number;
  readonly requestedBatchSize: number;
  readonly indexFormat: GeometryIndexFormat;
  readonly bounds: GeometryBounds;
  readonly layers: readonly RenderLayerDefinition<TSource, TLayerId>[];
}

interface RenderLayerChunk<TSource, TLayerId extends string> {
  readonly id: TLayerId;
  readonly geometry: PositionBufferGeometry;
  readonly writer: TriangleMeshWriter;
  readonly batch: DynamicMeshBatch;
  readonly source: FixedTopologyGeometrySource<TSource>;
}

interface RenderChunk<TSource, TLayerId extends string> {
  readonly range: ReturnType<typeof partitionBatches>[number]['range'];
  readonly layers: RenderLayerChunk<TSource, TLayerId>[];
}

/**
 * 将任意固定拓扑实体来源切分为少量多图层动态网格批次。
 */
export class FixedTopologyBatchRenderer<TSource, TLayerId extends string> {
  private readonly chunks: RenderChunk<TSource, TLayerId>[] = [];
  private disposed = false;

  constructor(private readonly options: FixedTopologyBatchRendererOptions<TSource, TLayerId>) {
    if (options.layers.length === 0) {
      throw new Error('固定拓扑批渲染器至少需要一个渲染层。');
    }

    let maximumBatchSize = Number.MAX_SAFE_INTEGER;
    for (const layer of options.layers) {
      maximumBatchSize = Math.min(
        maximumBatchSize,
        getMaximumIndexedEntityCount(layer.geometry.metrics, options.indexFormat),
      );
    }

    try {
      const partitions = partitionBatches(
        options.entityCount,
        options.requestedBatchSize,
        maximumBatchSize,
      );

      for (const partition of partitions) {
        const layerChunks: RenderLayerChunk<TSource, TLayerId>[] = [];
        this.chunks.push({ range: partition.range, layers: layerChunks });

        for (const layer of options.layers) {
          const geometry = createPositionGeometry(
            getTopologyVertexCount(layer.geometry.metrics, partition.range.count),
            getTopologyIndexCount(layer.geometry.metrics, partition.range.count),
            options.indexFormat,
          );
          const writer = new TriangleMeshWriter(geometry);
          writer.reset(true);
          layer.geometry.write(writer, options.source, partition.range);
          writer.commit();

          const batch = new DynamicMeshBatch();
          batch.initialize(
            options.parent,
            `${layer.nodeName}-${partition.index}`,
            geometry,
            layer.material,
            options.bounds,
          );
          layerChunks.push({
            id: layer.id,
            geometry,
            writer,
            batch,
            source: layer.geometry,
          });
        }
      }
    } catch (error: unknown) {
      this.dispose();
      throw error;
    }
  }

  /** 重写全部活动批次的位置流并上传到 GPU。 */
  public update(): void {
    if (this.disposed) {
      throw new Error('固定拓扑批渲染器已经释放。');
    }

    for (const chunk of this.chunks) {
      for (const layer of chunk.layers) {
        layer.writer.reset(false);
        layer.source.write(layer.writer, this.options.source, chunk.range);
        layer.writer.assertCounts(layer.geometry.vertexCount, layer.geometry.indexCount);
        layer.writer.commit();
        layer.batch.uploadPositions();
      }
    }
  }

  /** 释放所有动态网格批次，不销毁外部传入的材质。 */
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
