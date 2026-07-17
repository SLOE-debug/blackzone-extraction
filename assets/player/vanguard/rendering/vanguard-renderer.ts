import { type Material, Node } from 'cc';
import { GeometryIndexFormat } from '../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../core/mesh/mesh-dirty';
import { CompiledMeshBatchRenderer } from '../../../core/rendering/compiled-mesh-batch-renderer';
import { VanguardMeshEvaluator } from '../geometry/vanguard-mesh-evaluator';
import { type VanguardMeshPlan } from '../geometry/vanguard-mesh-plan';
import { VANGUARD_MATTE_MESH_PLAN } from '../geometry/vanguard-mesh-plans';
import { type VanguardState } from '../model/vanguard-state';
import { createVanguardBounds } from './vanguard-bounds';
import { VanguardMaterials } from './vanguard-materials';
import { VANGUARD_MATTE_MESH_PALETTE } from './vanguard-mesh-palette';

/** 主角皮肤、衣物与围巾共用的单一渲染层。 */
export enum VanguardRenderLayer {
  Character = 'character',
}

/** 组合主角单一材质层的编译式固定拓扑动态网格。 */
export class VanguardRenderer {
  private readonly materials: VanguardMaterials;
  private batches: CompiledMeshBatchRenderer<
    VanguardState,
    VanguardMeshPlan,
    VanguardRenderLayer
  > | null = null;
  private disposed = false;

  constructor(parent: Node, state: VanguardState, surfaceMaterialTemplate: Material) {
    this.materials = new VanguardMaterials(surfaceMaterialTemplate);
    const bounds = createVanguardBounds(state);
    try {
      this.batches = new CompiledMeshBatchRenderer({
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
            id: VanguardRenderLayer.Character,
            nodeName: 'VanguardCharacter',
            material: this.materials.character,
            plan: VANGUARD_MATTE_MESH_PLAN,
            evaluator: new VanguardMeshEvaluator(
              VANGUARD_MATTE_MESH_PLAN,
              VANGUARD_MATTE_MESH_PALETTE,
            ),
          }),
        ]),
      });
    } catch (error: unknown) {
      this.batches?.dispose();
      this.materials.dispose();
      throw error;
    }
  }

  /** 仅重写并上传主角连续人体的姿态位置和法线流。 */
  public update(): void {
    if (this.disposed || this.batches === null) {
      throw new Error('主角渲染器尚未初始化或已经释放。');
    }
    this.batches.update(MeshDirty.Pose);
  }

  /** 先释放动态网格，再释放其引用的材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.batches?.dispose();
    this.batches = null;
    this.materials.dispose();
    this.disposed = true;
  }
}
