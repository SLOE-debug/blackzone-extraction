import { Node } from 'cc';
import { GeometryIndexFormat } from '../../../../../core/geometry/buffer-geometry';
import { FixedTopologyBatchRenderer } from '../../../../../core/rendering/fixed-topology-batch-renderer';
import { curveCrawlerBodyGeometry } from '../geometry/curve-crawler-body-geometry';
import { curveCrawlerEyeGeometry } from '../geometry/curve-crawler-eye-geometry';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { computeCurveCrawlerBounds } from './curve-crawler-bounds';
import { CurveCrawlerMaterials } from './curve-crawler-materials';

/** Curve Crawler 使用的固定渲染层标识。 */
export enum CurveCrawlerRenderLayer {
  Body = 'body',
  Eyes = 'eyes',
}

/** 组合 Curve Crawler 材质和通用固定拓扑批渲染器。 */
export class CurveCrawlerRenderer {
  private readonly materials = new CurveCrawlerMaterials();
  private readonly batches: FixedTopologyBatchRenderer<CurveCrawlerState, CurveCrawlerRenderLayer>;
  private disposed = false;

  constructor(parent: Node, state: CurveCrawlerState, batchSize: number) {
    try {
      this.batches = new FixedTopologyBatchRenderer({
        parent,
        source: state,
        entityCount: state.count,
        requestedBatchSize: batchSize,
        indexFormat: GeometryIndexFormat.Uint16,
        bounds: computeCurveCrawlerBounds(state),
        layers: Object.freeze([
          Object.freeze({
            id: CurveCrawlerRenderLayer.Body,
            nodeName: 'CurveCrawlerBodyBatch',
            material: this.materials.body,
            geometry: curveCrawlerBodyGeometry,
          }),
          Object.freeze({
            id: CurveCrawlerRenderLayer.Eyes,
            nodeName: 'CurveCrawlerEyeBatch',
            material: this.materials.eyes,
            geometry: curveCrawlerEyeGeometry,
          }),
        ]),
      });
    } catch (error: unknown) {
      this.materials.dispose();
      throw error;
    }
  }

  /** 重写并上传全部 Curve Crawler 渲染层。 */
  public update(): void {
    if (this.disposed) {
      throw new Error('Curve Crawler 渲染器已经释放。');
    }
    this.batches.update();
  }

  /** 先释放动态网格，再释放其引用的材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.batches.dispose();
    this.materials.dispose();
    this.disposed = true;
  }
}
