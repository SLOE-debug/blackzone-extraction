import { type Material, Node } from 'cc';
import { GeometryIndexFormat } from '../../../core/geometry/buffer-geometry';
import { FixedTopologyBatchRenderer } from '../../../core/rendering/fixed-topology-batch-renderer';
import { vanguardMatteGeometry } from '../geometry/vanguard-matte-geometry';
import { vanguardMetalGeometry } from '../geometry/vanguard-metal-geometry';
import { type VanguardState } from '../model/vanguard-state';
import { createVanguardBounds } from './vanguard-bounds';
import { VanguardMaterials } from './vanguard-materials';
import {
  vanguardMatteVertexShading,
  vanguardMetalVertexShading,
} from './vanguard-vertex-shading';

/** 主角哑光人体与衣物渲染层。 */
export enum VanguardMatteRenderLayer {
  Matte = 'matte',
}

/** 主角长剑与扣件金属渲染层。 */
export enum VanguardMetalRenderLayer {
  Metal = 'metal',
}

/** 组合主角哑光与金属两层固定拓扑动态网格。 */
export class VanguardRenderer {
  private readonly materials: VanguardMaterials;
  private matteBatches: FixedTopologyBatchRenderer<
    VanguardState,
    VanguardMatteRenderLayer
  > | null = null;
  private metalBatches: FixedTopologyBatchRenderer<
    VanguardState,
    VanguardMetalRenderLayer
  > | null = null;
  private disposed = false;

  constructor(parent: Node, state: VanguardState, surfaceMaterialTemplate: Material) {
    this.materials = new VanguardMaterials(surfaceMaterialTemplate);
    const bounds = createVanguardBounds(state);
    try {
      this.matteBatches = new FixedTopologyBatchRenderer({
        parent,
        source: state,
        entityCount: state.count,
        requestedBatchSize: state.count,
        indexFormat: GeometryIndexFormat.Uint16,
        bounds,
        surfaceOptions: Object.freeze({
          uploadLightingAttributes: true,
          castShadows: true,
          receiveShadows: true,
        }),
        shading: vanguardMatteVertexShading,
        layers: Object.freeze([
          Object.freeze({
            id: VanguardMatteRenderLayer.Matte,
            nodeName: 'VanguardMatte',
            material: this.materials.matte,
            geometry: vanguardMatteGeometry,
          }),
        ]),
      });
      this.metalBatches = new FixedTopologyBatchRenderer({
        parent,
        source: state,
        entityCount: state.count,
        requestedBatchSize: state.count,
        indexFormat: GeometryIndexFormat.Uint16,
        bounds,
        surfaceOptions: Object.freeze({
          uploadLightingAttributes: true,
          castShadows: true,
          receiveShadows: true,
        }),
        shading: vanguardMetalVertexShading,
        layers: Object.freeze([
          Object.freeze({
            id: VanguardMetalRenderLayer.Metal,
            nodeName: 'VanguardMetal',
            material: this.materials.metal,
            geometry: vanguardMetalGeometry,
          }),
        ]),
      });
    } catch (error: unknown) {
      this.metalBatches?.dispose();
      this.matteBatches?.dispose();
      this.materials.dispose();
      throw error;
    }
  }

  /** 重写并上传主角连续人体与长剑的动态顶点流。 */
  public update(): void {
    if (this.disposed || this.matteBatches === null || this.metalBatches === null) {
      throw new Error('主角渲染器尚未初始化或已经释放。');
    }
    this.matteBatches.update();
    this.metalBatches.update();
  }

  /** 先释放动态网格，再释放其引用的材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.metalBatches?.dispose();
    this.matteBatches?.dispose();
    this.metalBatches = null;
    this.matteBatches = null;
    this.materials.dispose();
    this.disposed = true;
  }
}
