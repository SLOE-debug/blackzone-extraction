import { type Material, Node } from 'cc';
import { GeometryIndexFormat } from '../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../core/mesh/mesh-dirty';
import { CompiledMeshBatchRenderer } from '../../../core/rendering/compiled-mesh-batch-renderer';
import { VanguardMeshEvaluator } from '../geometry/vanguard-mesh-evaluator';
import { type VanguardMeshPlan } from '../geometry/vanguard-mesh-plan';
import {
  VANGUARD_MATTE_MESH_PLAN,
  VANGUARD_METAL_MESH_PLAN,
} from '../geometry/vanguard-mesh-plans';
import { type VanguardState } from '../model/vanguard-state';
import { createVanguardBounds } from './vanguard-bounds';
import { VanguardMaterials } from './vanguard-materials';
import {
  VANGUARD_MATTE_MESH_PALETTE,
  VANGUARD_METAL_MESH_PALETTE,
} from './vanguard-mesh-palette';

/** 主角哑光人体与衣物渲染层。 */
export enum VanguardMatteRenderLayer {
  Matte = 'matte',
}

/** 主角长剑与扣件金属渲染层。 */
export enum VanguardMetalRenderLayer {
  Metal = 'metal',
}

/** 组合主角哑光与金属两层编译式固定拓扑动态网格。 */
export class VanguardRenderer {
  private readonly materials: VanguardMaterials;
  private matteBatches: CompiledMeshBatchRenderer<
    VanguardState,
    VanguardMeshPlan,
    VanguardMatteRenderLayer
  > | null = null;
  private metalBatches: CompiledMeshBatchRenderer<
    VanguardState,
    VanguardMeshPlan,
    VanguardMetalRenderLayer
  > | null = null;
  private disposed = false;

  constructor(parent: Node, state: VanguardState, surfaceMaterialTemplate: Material) {
    this.materials = new VanguardMaterials(surfaceMaterialTemplate);
    const bounds = createVanguardBounds(state);
    try {
      this.matteBatches = new CompiledMeshBatchRenderer({
        parent,
        state,
        entityCount: state.count,
        requestedBatchSize: state.count,
        indexFormat: GeometryIndexFormat.Uint16,
        bounds,
        surfaceOptions: Object.freeze({
          uploadLightingAttributes: true,
          castShadows: true,
          receiveShadows: true,
        }),
        layers: Object.freeze([
          Object.freeze({
            id: VanguardMatteRenderLayer.Matte,
            nodeName: 'VanguardMatte',
            material: this.materials.matte,
            plan: VANGUARD_MATTE_MESH_PLAN,
            evaluator: new VanguardMeshEvaluator(
              VANGUARD_MATTE_MESH_PLAN,
              VANGUARD_MATTE_MESH_PALETTE,
            ),
          }),
        ]),
      });
      this.metalBatches = new CompiledMeshBatchRenderer({
        parent,
        state,
        entityCount: state.count,
        requestedBatchSize: state.count,
        indexFormat: GeometryIndexFormat.Uint16,
        bounds,
        surfaceOptions: Object.freeze({
          uploadLightingAttributes: true,
          castShadows: true,
          receiveShadows: true,
        }),
        layers: Object.freeze([
          Object.freeze({
            id: VanguardMetalRenderLayer.Metal,
            nodeName: 'VanguardMetal',
            material: this.materials.metal,
            plan: VANGUARD_METAL_MESH_PLAN,
            evaluator: new VanguardMeshEvaluator(
              VANGUARD_METAL_MESH_PLAN,
              VANGUARD_METAL_MESH_PALETTE,
            ),
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

  /** 仅重写并上传主角连续人体与长剑的姿态位置和法线流。 */
  public update(): void {
    if (this.disposed || this.matteBatches === null || this.metalBatches === null) {
      throw new Error('主角渲染器尚未初始化或已经释放。');
    }
    const poseDirty = MeshDirty.Pose;
    this.matteBatches.update(poseDirty);
    this.metalBatches.update(poseDirty);
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
