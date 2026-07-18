import { type Material, Node } from 'cc';
import { GeometryIndexFormat } from '../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../core/mesh/mesh-dirty';
import { CompiledMeshBatchRenderer } from '../../../../core/rendering/compiled-mesh-batch-renderer';
import { BATTLEFIELD_ENVIRONMENT_MESH_PLANS } from '../geometry/battlefield-environment-mesh-plans';
import { type BattlefieldEnvironmentMeshPlan } from '../geometry/battlefield-environment-mesh-plan';
import {
  BATTLEFIELD_ENVIRONMENT_PROTOTYPE_CONFIG,
} from '../model/battlefield-environment-config';
import { BattlefieldEnvironmentMaterialKind } from '../model/battlefield-environment-material-kind';
import {
  BATTLEFIELD_ENVIRONMENT_PROTOTYPES,
  type BattlefieldEnvironmentPrototype,
} from '../model/battlefield-environment-prototype';
import {
  type BattlefieldEnvironmentArchetypeState,
  BattlefieldEnvironmentWorldState,
} from '../model/battlefield-environment-state';
import { BattlefieldEnvironmentMaterials } from './battlefield-environment-materials';
import {
  BattlefieldEnvironmentMeshEvaluator,
  computeBattlefieldEnvironmentBounds,
} from './battlefield-environment-mesh-evaluator';

enum BattlefieldEnvironmentRenderLayer {
  Geometry = 'geometry',
}

interface BattlefieldEnvironmentRenderEntry {
  readonly prototype: BattlefieldEnvironmentPrototype;
  readonly state: BattlefieldEnvironmentArchetypeState;
  readonly plan: BattlefieldEnvironmentMeshPlan;
  readonly renderer: CompiledMeshBatchRenderer<
    BattlefieldEnvironmentArchetypeState,
    BattlefieldEnvironmentMeshPlan,
    BattlefieldEnvironmentRenderLayer
  >;
}

/** 以每原型一个固定拓扑批次渲染整个活动 Chunk 窗口。 */
export class BattlefieldEnvironmentRenderer {
  private readonly materials: BattlefieldEnvironmentMaterials;
  private readonly entries: BattlefieldEnvironmentRenderEntry[] = [];
  private disposed = false;

  constructor(
    parent: Node,
    world: BattlefieldEnvironmentWorldState,
    surfaceMaterialTemplate: Material,
  ) {
    this.materials = new BattlefieldEnvironmentMaterials(surfaceMaterialTemplate);
    try {
      for (const prototype of BATTLEFIELD_ENVIRONMENT_PROTOTYPES) {
        const config = BATTLEFIELD_ENVIRONMENT_PROTOTYPE_CONFIG[prototype];
        const state = world.get(prototype);
        const plan = BATTLEFIELD_ENVIRONMENT_MESH_PLANS[prototype];
        const glowing = config.materialKind === BattlefieldEnvironmentMaterialKind.Glow;
        const renderer = new CompiledMeshBatchRenderer({
          parent,
          state,
          entityCount: state.count,
          requestedBatchSize: config.requestedBatchSize,
          indexFormat: GeometryIndexFormat.Uint16,
          bounds: computeBattlefieldEnvironmentBounds(state, plan),
          surfaceOptions: Object.freeze({
            uploadLightingAttributes: !glowing,
            castShadows: false,
            receiveShadows: false,
          }),
          layers: Object.freeze([
            Object.freeze({
              id: BattlefieldEnvironmentRenderLayer.Geometry,
              nodeName: config.nodeName,
              material: this.materials.get(config.materialKind),
              plan,
              evaluator: new BattlefieldEnvironmentMeshEvaluator(),
            }),
          ]),
        });
        this.entries.push({ prototype, state, plan, renderer });
      }
    } catch (error: unknown) {
      this.dispose();
      throw error;
    }
  }

  /** Chunk 窗口改变后一次性重写复用槽位的顶点流和裁剪包围盒。 */
  public synchronize(): void {
    if (this.disposed) {
      throw new Error('战场环境渲染器已经释放。');
    }
    for (const entry of this.entries) {
      entry.renderer.update(
        MeshDirty.All,
        computeBattlefieldEnvironmentBounds(entry.state, entry.plan),
      );
    }
  }

  /** 先释放全部批次，再释放共享材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    for (const entry of this.entries) {
      entry.renderer.dispose();
    }
    this.entries.length = 0;
    this.materials.dispose();
    this.disposed = true;
  }
}
