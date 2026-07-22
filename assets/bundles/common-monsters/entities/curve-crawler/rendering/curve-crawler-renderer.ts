import { type Material, Node } from 'cc';
import { GeometryIndexFormat } from '../../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../../core/mesh/mesh-dirty';
import { CompiledMeshBatchRenderer } from '../../../../../core/rendering/compiled-mesh-batch-renderer';
import { EntityRenderDirty } from '../../../../../core/rendering/dynamic-entities/entity-render-dirty';
import { curveCrawlerMeshPlan } from '../geometry/curve-crawler-mesh-compiler';
import { curveCrawlerMeshEvaluator } from '../geometry/curve-crawler-mesh-evaluator';
import { type CurveCrawlerMeshPlan } from '../geometry/curve-crawler-mesh-plan';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import {
  createCurveCrawlerBounds,
  type CurveCrawlerBounds,
  updateCurveCrawlerBounds,
} from './curve-crawler-bounds';
import { CurveCrawlerMaterials } from './curve-crawler-materials';
import { type CurveCrawlerPopulationRendering } from './curve-crawler-population-rendering';

/** Curve Crawler 使用的固定渲染层标识。 */
export enum CurveCrawlerRenderLayer {
  Surface = 'surface',
}

/** 组合 Curve Crawler 材质和编译式固定拓扑批渲染器。 */
export class CurveCrawlerRenderer implements CurveCrawlerPopulationRendering {
  private readonly materials: CurveCrawlerMaterials;
  private readonly batches: CompiledMeshBatchRenderer<
    CurveCrawlerState,
    CurveCrawlerMeshPlan,
    CurveCrawlerRenderLayer
  >;
  private readonly bounds: CurveCrawlerBounds;
  /** 上一次已经提交给 Cocos 裁剪系统的六个模型空间边界分量。 */
  private previousMinX = 0;
  private previousMinY = 0;
  private previousMinZ = 0;
  private previousMaxX = 0;
  private previousMaxY = 0;
  private previousMaxZ = 0;
  private disposed = false;

  constructor(
    parent: Node,
    private readonly state: CurveCrawlerState,
    surfaceMaterialTemplate: Material,
  ) {
    this.bounds = createCurveCrawlerBounds(state);
    this.materials = new CurveCrawlerMaterials(
      surfaceMaterialTemplate,
    );
    try {
      this.batches = new CompiledMeshBatchRenderer({
        parent,
        state,
        entityCount: state.count,
        requestedBatchSize: state.count,
        indexFormat: GeometryIndexFormat.Uint32,
        bounds: this.bounds,
        surfaceOptions: Object.freeze({
          castShadows: true,
          receiveShadows: true,
        }),
        layers: Object.freeze([
          Object.freeze({
            id: CurveCrawlerRenderLayer.Surface,
            nodeName: 'CurveCrawlerSurfaceBatch',
            material: this.materials.surface,
            plan: curveCrawlerMeshPlan,
            evaluator: curveCrawlerMeshEvaluator,
          }),
        ]),
      });
      this.captureBoundsState();
      this.state.renderChanges.clearAll();
    } catch (error: unknown) {
      this.materials.dispose();
      throw error;
    }
  }

  /** 更新姿态与包围盒，并且只在受击或液体事件变化时上传颜色流。 */
  public update(): void {
    if (this.disposed) {
      throw new Error('Curve Crawler 渲染器已经释放。');
    }
    updateCurveCrawlerBounds(this.state, this.bounds);
    const boundsChanged = this.captureBoundsState();
    let dirty = MeshDirty.Pose;
    if (boundsChanged) {
      dirty |= MeshDirty.Bounds;
    }
    if (this.state.renderChanges.hasAny(EntityRenderDirty.Color)) {
      dirty |= MeshDirty.Color;
    }
    this.batches.update(dirty, boundsChanged ? this.bounds : undefined);
    this.state.renderChanges.clearAll();
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

  /** 比较并保存本地裁剪边界，避免静止展示实体每帧刷新 Renderer 几何状态。 */
  private captureBoundsState(): boolean {
    const bounds = this.bounds;
    const changed = this.previousMinX !== bounds.minX
      || this.previousMinY !== bounds.minY
      || this.previousMinZ !== bounds.minZ
      || this.previousMaxX !== bounds.maxX
      || this.previousMaxY !== bounds.maxY
      || this.previousMaxZ !== bounds.maxZ;
    this.previousMinX = bounds.minX;
    this.previousMinY = bounds.minY;
    this.previousMinZ = bounds.minZ;
    this.previousMaxX = bounds.maxX;
    this.previousMaxY = bounds.maxY;
    this.previousMaxZ = bounds.maxZ;
    return changed;
  }
}
