import { type Material, Node } from 'cc';
import { GeometryIndexFormat } from '../../../../../core/geometry/buffer-geometry';
import { FixedTopologyBatchRenderer } from '../../../../../core/rendering/fixed-topology-batch-renderer';
import { curveCrawlerSurfaceGeometry } from '../geometry/curve-crawler-surface-geometry';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import {
  createCurveCrawlerBounds,
  type CurveCrawlerBounds,
  updateCurveCrawlerBounds,
} from './curve-crawler-bounds';
import { CurveCrawlerMaterials } from './curve-crawler-materials';
import { curveCrawlerVertexShading } from './curve-crawler-vertex-shading';

/** Curve Crawler 使用的固定渲染层标识。 */
export enum CurveCrawlerRenderLayer {
  Surface = 'surface',
}

/** 组合 Curve Crawler 材质和通用固定拓扑批渲染器。 */
export class CurveCrawlerRenderer {
  private readonly materials: CurveCrawlerMaterials;
  private readonly batches: FixedTopologyBatchRenderer<CurveCrawlerState, CurveCrawlerRenderLayer>;
  private readonly bounds: CurveCrawlerBounds;
  private disposed = false;

  constructor(
    parent: Node,
    private readonly state: CurveCrawlerState,
    surfaceMaterialTemplate: Material,
  ) {
    this.bounds = createCurveCrawlerBounds(state);
    this.materials = new CurveCrawlerMaterials(surfaceMaterialTemplate);
    try {
      this.batches = new FixedTopologyBatchRenderer({
        parent,
        source: state,
        entityCount: state.count,
        requestedBatchSize: state.count,
        indexFormat: GeometryIndexFormat.Uint32,
        bounds: this.bounds,
        surfaceOptions: Object.freeze({
          uploadLightingAttributes: true,
          castShadows: true,
          receiveShadows: true,
        }),
        shading: curveCrawlerVertexShading,
        layers: Object.freeze([
          Object.freeze({
            id: CurveCrawlerRenderLayer.Surface,
            nodeName: 'CurveCrawlerSurfaceBatch',
            material: this.materials.surface,
            geometry: curveCrawlerSurfaceGeometry,
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
    updateCurveCrawlerBounds(this.state, this.bounds);
    this.batches.update(this.bounds);
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
