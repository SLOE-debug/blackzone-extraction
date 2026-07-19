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
  evaluateBattlefieldEnvironmentSectionRange,
  type MutableBattlefieldEnvironmentBounds,
  writeBattlefieldEnvironmentWorldBounds,
} from './battlefield-environment-mesh-evaluator';
import {
  BattlefieldEnvironmentUpdateCursor,
  type MutableBattlefieldEnvironmentUpdateRange,
} from './battlefield-environment-update-cursor';

const ENVIRONMENT_SURFACE_OPTIONS: DynamicMeshBatchOptions = Object.freeze({
  castShadows: false,
  receiveShadows: false,
});

/** 单帧最多重算约 6.5 万环境顶点，把 Chunk 切换尖峰摊到数帧。 */
const ENVIRONMENT_UPDATE_VERTEX_BUDGET = 65_536;

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
  private readonly updateCursor: BattlefieldEnvironmentUpdateCursor;
  private readonly updateRange: MutableBattlefieldEnvironmentUpdateRange = {
    sectionIndex: 0,
    firstEntity: 0,
    entityCount: 0,
    vertexCount: 0,
  };
  private readonly bounds: MutableBattlefieldEnvironmentBounds = {
    minX: 0,
    minY: 0,
    minZ: 0,
    maxX: 0,
    maxY: 0,
    maxZ: 0,
  };
  private uploadPending = false;
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
    this.updateCursor = new BattlefieldEnvironmentUpdateCursor(
      this.sections.map((section) => Object.freeze({
        entityCount: section.layout.repeatCount,
        verticesPerEntity: section.layout.plan.vertexCount,
      })),
    );
    try {
      this.batch.initialize(
        parent,
        'BattlefieldEnvironmentMegaBatch',
        this.geometry,
        this.materials.unified,
        this.bounds,
        ENVIRONMENT_SURFACE_OPTIONS,
      );
      this.batch.setVisible(false);
      this.requestSynchronization();
    } catch (error: unknown) {
      this.dispose();
      throw error;
    }
  }

  /** Chunk 窗口改变后重启多帧求值，旧 GPU 网格保持可见直到新数据完整。 */
  public requestSynchronization(): void {
    if (this.disposed) {
      throw new Error('战场环境渲染器已经释放。');
    }
    this.updateCursor.restart();
    this.uploadPending = false;
  }

  /** 在固定顶点预算内推进 CPU 求值，并在下一帧一次性提交完整 GPU 缓冲。 */
  public updateSynchronization(): void {
    if (this.disposed) {
      throw new Error('战场环境渲染器已经释放。');
    }
    if (this.updateCursor.active) {
      let remainingVertices = ENVIRONMENT_UPDATE_VERTEX_BUDGET;
      while (remainingVertices > 0
        && this.updateCursor.writeNext(remainingVertices, this.updateRange)) {
        const section = this.sections[this.updateRange.sectionIndex];
        if (section === undefined) {
          throw new Error('环境更新任务指向了不存在的渲染区段。');
        }
        evaluateBattlefieldEnvironmentSectionRange(
          this.world.get(section.layout.id),
          section.layout.plan,
          section.streams,
          this.updateRange.firstEntity,
          this.updateRange.entityCount,
        );
        remainingVertices -= this.updateRange.vertexCount;
      }
      if (!this.updateCursor.active) {
        this.uploadPending = true;
      }
      return;
    }
    if (!this.uploadPending) {
      return;
    }
    this.batch.uploadVertexAttributes(MeshDirty.Position | MeshDirty.Color);
    writeBattlefieldEnvironmentWorldBounds(
      this.world,
      this.preparation.prototypes,
      this.bounds,
    );
    this.batch.updateBounds(this.bounds);
    this.batch.setVisible(true);
    this.uploadPending = false;
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
