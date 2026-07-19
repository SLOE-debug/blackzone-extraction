import { Node } from 'cc';
import {
  createVertexLayoutGeometry,
  GeometryIndexFormat,
  type UnlitColorBufferGeometry,
} from '../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../core/mesh/mesh-dirty';
import {
  DynamicMeshBatch,
  type DynamicMeshBatchOptions,
} from '../../../../core/rendering/dynamic-mesh-batch';
import {
  type BattlefieldEnvironmentMegaMeshSection,
} from '../geometry/battlefield-environment-mega-mesh-layout';
import { type PreparedBattlefieldEnvironment } from '../compilation/battlefield-environment-preparation';
import { BattlefieldEnvironmentWorldState } from '../model/battlefield-environment-state';
import { BattlefieldEnvironmentMaterials } from './battlefield-environment-materials';
import {
  type BattlefieldEnvironmentSectionStreams,
  evaluateBattlefieldEnvironmentSection,
  type MutableBattlefieldEnvironmentBounds,
  writeBattlefieldEnvironmentWorldBounds,
} from './battlefield-environment-mesh-evaluator';

const ENVIRONMENT_SURFACE_OPTIONS: DynamicMeshBatchOptions = Object.freeze({
  castShadows: false,
  receiveShadows: false,
});

interface BattlefieldEnvironmentRenderSection {
  readonly layout: BattlefieldEnvironmentMegaMeshSection;
  readonly streams: BattlefieldEnvironmentSectionStreams;
}

/** 将全部环境 Archetype 压入单材质、单 MeshRenderer 的统一大网格。 */
export class BattlefieldEnvironmentRenderer {
  private readonly materials: BattlefieldEnvironmentMaterials;
  private readonly geometry: UnlitColorBufferGeometry;
  private readonly batch = new DynamicMeshBatch();
  private readonly sections: readonly BattlefieldEnvironmentRenderSection[];
  private readonly bounds: MutableBattlefieldEnvironmentBounds = {
    minX: 0,
    minY: 0,
    minZ: 0,
    maxX: 0,
    maxY: 0,
    maxZ: 0,
  };
  private disposed = false;

  constructor(
    parent: Node,
    private readonly world: BattlefieldEnvironmentWorldState,
    private readonly preparation: PreparedBattlefieldEnvironment,
  ) {
    this.materials = new BattlefieldEnvironmentMaterials();
    const layout = preparation.megaMeshLayout;
    this.geometry = createVertexLayoutGeometry(
      layout.vertexLayout,
      layout.vertexCount,
      layout.indexCount,
      GeometryIndexFormat.Uint32,
    );
    this.geometry.commitCounts(layout.vertexCount, layout.indexCount);
    this.geometry.index.set(layout.indices);
    this.sections = Object.freeze(layout.sections.map((section) => Object.freeze({
      layout: section,
      streams: createSectionStreams(this.geometry, section),
    })));
    try {
      this.evaluateSections();
      writeBattlefieldEnvironmentWorldBounds(
        this.world,
        this.preparation.prototypes,
        this.bounds,
      );
      this.batch.initialize(
        parent,
        'BattlefieldEnvironmentMegaBatch',
        this.geometry,
        this.materials.unified,
        this.bounds,
        ENVIRONMENT_SURFACE_OPTIONS,
      );
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
    this.evaluateSections();
    this.batch.uploadVertexAttributes(MeshDirty.Position | MeshDirty.Color);
    writeBattlefieldEnvironmentWorldBounds(
      this.world,
      this.preparation.prototypes,
      this.bounds,
    );
    this.batch.updateBounds(this.bounds);
  }

  /** 先释放统一大网格，再释放其独占材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.batch.dispose();
    this.materials.dispose();
    this.disposed = true;
  }

  private evaluateSections(): void {
    for (const section of this.sections) {
      evaluateBattlefieldEnvironmentSection(
        this.world.get(section.layout.id),
        section.layout.plan,
        section.streams,
      );
    }
  }
}

function createSectionStreams(
  geometry: UnlitColorBufferGeometry,
  section: Readonly<BattlefieldEnvironmentMegaMeshSection>,
): BattlefieldEnvironmentSectionStreams {
  const firstVertex = section.vertexOffset;
  const endVertex = firstVertex + section.vertexCount;
  return Object.freeze({
    positions: geometry.positions.subarray(firstVertex * 3, endVertex * 3),
    colors: geometry.colors.subarray(firstVertex * 4, endVertex * 4),
  });
}
