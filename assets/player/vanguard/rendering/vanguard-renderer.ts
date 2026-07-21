import { type Material, Node } from 'cc';
import { GeometryIndexFormat } from '../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../core/mesh/mesh-dirty';
import { CompiledMeshBatchRenderer } from '../../../core/rendering/compiled-mesh-batch-renderer';
import { VanguardMeshEvaluator } from '../geometry/vanguard-mesh-evaluator';
import { type VanguardMeshPlan } from '../geometry/vanguard-mesh-plan';
import { VanguardRenderMode } from '../model/vanguard-render-mode';
import { VANGUARD_MATTE_MESH_PLAN } from '../geometry/vanguard-mesh-plans';
import { type VanguardState } from '../model/vanguard-state';
import { writeVanguardBounds } from './vanguard-bounds';
import { VanguardMaterials } from './vanguard-materials';
import { VANGUARD_MATTE_MESH_PALETTE } from './vanguard-mesh-palette';

/** 主角皮肤、衣物、帽子与披肩共用的单一渲染层。 */
export enum VanguardRenderLayer {
  Character = 'character',
}

/** 组合主角单一材质层的编译式固定拓扑动态网格。 */
export class VanguardRenderer {
  private readonly materials: VanguardMaterials;
  private readonly bounds = {
    minX: 0,
    minY: 0,
    minZ: 0,
    maxX: 0,
    maxY: 0,
    maxZ: 0,
  };
  private batches: CompiledMeshBatchRenderer<
    VanguardState,
    VanguardMeshPlan,
    VanguardRenderLayer
  > | null = null;
  private previousHitFlash = 0;
  private disposed = false;

  constructor(
    parent: Node,
    state: VanguardState,
    surfaceMaterialTemplate: Material,
    renderMode: VanguardRenderMode,
  ) {
    this.materials = new VanguardMaterials(surfaceMaterialTemplate, renderMode);
    writeVanguardBounds(state, this.bounds);
    try {
      this.batches = new CompiledMeshBatchRenderer({
        parent,
        state,
        entityCount: state.count,
        requestedBatchSize: state.count,
        indexFormat: GeometryIndexFormat.Uint16,
        bounds: this.bounds,
        surfaceOptions: Object.freeze({
          castShadows: renderMode === VanguardRenderMode.Lit,
          receiveShadows: renderMode === VanguardRenderMode.Lit,
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

  /** 重写并上传主角连续人体的姿态流，同时刷新移动后的裁剪包围盒。 */
  public update(state: VanguardState): void {
    if (this.disposed || this.batches === null) {
      throw new Error('主角渲染器尚未初始化或已经释放。');
    }
    writeVanguardBounds(state, this.bounds);
    const hitFlash = state.data.animation.hitFlash[0] ?? 0;
    const colorChanged = Math.abs(hitFlash - this.previousHitFlash) > 0.001;
    this.batches.update(
      colorChanged ? MeshDirty.All : MeshDirty.Geometry,
      this.bounds,
    );
    this.previousHitFlash = hitFlash;
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
