import { type Material, Node } from 'cc';
import {
  createEntityRange,
  type EntityRange,
} from '../../../../../core/entities/entity-range';
import {
  createSurfaceGeometry,
  GeometryIndexFormat,
  type SurfaceBufferGeometry,
} from '../../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../../core/mesh/mesh-dirty';
import { copyMeshPlanIndices } from '../../../../../core/mesh/mesh-plan-indices';
import { type VertexStreams } from '../../../../../core/mesh/vertex-streams';
import { DynamicMeshBatch } from '../../../../../core/rendering/dynamic-mesh-batch';
import { curveCrawlerMeshPlan } from '../geometry/curve-crawler-mesh-compiler';
import { curveCrawlerMeshEvaluator } from '../geometry/curve-crawler-mesh-evaluator';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import {
  createCurveCrawlerBounds,
  type CurveCrawlerBounds,
  updateCurveCrawlerBounds,
} from './curve-crawler-bounds';
import { CurveCrawlerColorSnapshot } from './curve-crawler-color-snapshot';
import { CurveCrawlerMaterials } from './curve-crawler-materials';
import { type CurveCrawlerPopulationRendering } from './curve-crawler-population-rendering';

const SHARED_SURFACE_OPTIONS = Object.freeze({
  castShadows: true,
  receiveShadows: true,
});

interface CurveCrawlerSharedRenderEntry {
  readonly state: CurveCrawlerState;
  readonly range: EntityRange;
  readonly bounds: CurveCrawlerBounds;
  readonly colors: CurveCrawlerColorSnapshot;
  streams: VertexStreams | null;
  dirty: boolean;
  active: boolean;
}

/** 将多个独立 Curve Crawler 群体压入同一个动态 MeshRenderer。 */
export class CurveCrawlerSharedRenderer {
  private readonly materials: CurveCrawlerMaterials;
  private readonly entries: CurveCrawlerSharedRenderEntry[] = [];
  private readonly bounds: CurveCrawlerBounds = {
    minX: 0,
    minY: 0,
    minZ: -1,
    maxX: 0,
    maxY: 0,
    maxZ: 1,
  };
  private batch: DynamicMeshBatch | null = null;
  private geometry: SurfaceBufferGeometry | null = null;
  private entityCapacity = 0;
  private structureDirty = false;
  private disposed = false;

  constructor(
    private readonly parent: Node,
    surfaceMaterialTemplate: Material,
  ) {
    this.materials = new CurveCrawlerMaterials(surfaceMaterialTemplate);
  }

  /** 登记一个独立模拟状态，并返回只控制该区段的轻量句柄。 */
  public register(state: CurveCrawlerState): CurveCrawlerPopulationRendering {
    this.ensureActive();
    const entry: CurveCrawlerSharedRenderEntry = {
      state,
      range: createEntityRange(0, state.count, state.count),
      bounds: createCurveCrawlerBounds(state),
      colors: new CurveCrawlerColorSnapshot(state),
      streams: null,
      dirty: true,
      active: true,
    };
    this.entries.push(entry);
    this.structureDirty = true;
    return new CurveCrawlerSharedRenderHandle(this, entry);
  }

  /** 每帧只进行一次全批求值上传；Chunk 结构变化时才重建固定拓扑。 */
  public synchronize(): void {
    this.ensureActive();
    if (this.structureDirty) {
      this.rebuild();
      return;
    }
    const batch = this.batch;
    if (batch === null) {
      return;
    }

    let changed = MeshDirty.None;
    for (const entry of this.entries) {
      if (!entry.dirty || entry.streams === null) {
        continue;
      }
      let requested = MeshDirty.Pose;
      if (entry.colors.capture()) {
        requested |= MeshDirty.Color;
      }
      changed |= curveCrawlerMeshEvaluator.evaluate(
        entry.state,
        curveCrawlerMeshPlan,
        entry.streams,
        entry.range,
        requested,
      );
      entry.dirty = false;
    }
    if ((changed & (MeshDirty.Position | MeshDirty.Normal | MeshDirty.Color)) !== 0) {
      batch.uploadVertexAttributes(changed);
    }
    if (this.updateBounds()) {
      batch.updateBounds(this.bounds);
    }
  }

  /** 释放唯一批次与唯一材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const entry of this.entries) {
      entry.active = false;
      entry.streams = null;
    }
    this.entries.length = 0;
    this.batch?.dispose();
    this.batch = null;
    this.geometry = null;
    this.entityCapacity = 0;
    this.materials.dispose();
  }

  /** 标记一个群体区段需要在下一次统一同步时重写。 */
  public markDirty(entry: CurveCrawlerSharedRenderEntry): void {
    if (!this.disposed && entry.active) {
      entry.dirty = true;
    }
  }

  /** 从共享拓扑中移除群体；实际 GPU 重建推迟到统一同步点。 */
  public unregister(entry: CurveCrawlerSharedRenderEntry): void {
    if (this.disposed || !entry.active) {
      return;
    }
    entry.active = false;
    entry.streams = null;
    const index = this.entries.indexOf(entry);
    if (index >= 0) {
      this.entries.splice(index, 1);
      this.structureDirty = true;
    }
  }

  private rebuild(): void {
    const entityCount = this.entries.reduce((total, entry) => total + entry.state.count, 0);
    if (entityCount === 0) {
      this.batch?.setVisible(false);
      this.structureDirty = false;
      return;
    }

    const plan = curveCrawlerMeshPlan;
    const requiresGrowth = this.batch === null
      || this.geometry === null
      || entityCount > this.entityCapacity;
    const nextCapacity = requiresGrowth
      ? getExpandedEntityCapacity(entityCount)
      : this.entityCapacity;
    const geometry = requiresGrowth
      ? createSharedGeometry(nextCapacity)
      : this.geometry;
    if (geometry === null) {
      throw new Error('Curve Crawler 共享几何在容量复用时不存在。');
    }

    let entityOffset = 0;
    for (const entry of this.entries) {
      entry.streams = createEntryStreams(geometry, entityOffset, entry.state.count);
      curveCrawlerMeshEvaluator.evaluate(
        entry.state,
        plan,
        entry.streams,
        entry.range,
        MeshDirty.All,
      );
      entry.colors.capture();
      entry.dirty = false;
      entityOffset += entry.state.count;
    }
    collapseUnusedEntities(geometry, entityOffset, nextCapacity);
    this.updateBounds(true);

    if (requiresGrowth) {
      const nextBatch = new DynamicMeshBatch();
      try {
        nextBatch.initialize(
          this.parent,
          'CurveCrawlerSharedBatch',
          geometry,
          this.materials.surface,
          this.bounds,
          SHARED_SURFACE_OPTIONS,
        );
      } catch (error: unknown) {
        nextBatch.dispose();
        for (const entry of this.entries) {
          entry.streams = null;
          entry.dirty = true;
        }
        throw error;
      }
      this.batch?.dispose();
      this.batch = nextBatch;
      this.geometry = geometry;
      this.entityCapacity = nextCapacity;
    } else {
      this.batch?.uploadVertexAttributes(MeshDirty.All);
      this.batch?.updateBounds(this.bounds);
    }
    this.batch?.setVisible(true);
    this.structureDirty = false;
  }

  private updateBounds(force = false): boolean {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (const entry of this.entries) {
      updateCurveCrawlerBounds(entry.state, entry.bounds);
      minX = Math.min(minX, entry.bounds.minX);
      minY = Math.min(minY, entry.bounds.minY);
      minZ = Math.min(minZ, entry.bounds.minZ);
      maxX = Math.max(maxX, entry.bounds.maxX);
      maxY = Math.max(maxY, entry.bounds.maxY);
      maxZ = Math.max(maxZ, entry.bounds.maxZ);
    }
    const changed = force
      || this.bounds.minX !== minX
      || this.bounds.minY !== minY
      || this.bounds.minZ !== minZ
      || this.bounds.maxX !== maxX
      || this.bounds.maxY !== maxY
      || this.bounds.maxZ !== maxZ;
    this.bounds.minX = minX;
    this.bounds.minY = minY;
    this.bounds.minZ = minZ;
    this.bounds.maxX = maxX;
    this.bounds.maxY = maxY;
    this.bounds.maxZ = maxZ;
    return changed;
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('Curve Crawler 共享渲染器已经释放。');
    }
  }
}

/** 只拥有一个共享批次登记项，不会误销毁其他群体资源。 */
class CurveCrawlerSharedRenderHandle implements CurveCrawlerPopulationRendering {
  constructor(
    private readonly owner: CurveCrawlerSharedRenderer,
    private readonly entry: CurveCrawlerSharedRenderEntry,
  ) {}

  public update(): void {
    this.owner.markDirty(this.entry);
  }

  public dispose(): void {
    this.owner.unregister(this.entry);
  }
}

/** 为一个群体创建指向统一 SoA 缓冲连续区段的顶点流视图。 */
function createEntryStreams(
  geometry: SurfaceBufferGeometry,
  entityOffset: number,
  entityCount: number,
): VertexStreams {
  const firstVertex = entityOffset * curveCrawlerMeshPlan.vertexCount;
  const endVertex = firstVertex + entityCount * curveCrawlerMeshPlan.vertexCount;
  return Object.freeze({
    positions: geometry.positions.subarray(firstVertex * 3, endVertex * 3),
    normals: geometry.normals.subarray(firstVertex * 3, endVertex * 3),
    colors: geometry.colors.subarray(firstVertex * 4, endVertex * 4),
  });
}

/** 以二次幂预留有限余量，避免 Chunk 实体数轻微波动时反复重建 GPU Mesh。 */
function getExpandedEntityCapacity(entityCount: number): number {
  let capacity = 1;
  while (capacity < entityCount) {
    capacity *= 2;
  }
  return capacity;
}

function createSharedGeometry(entityCapacity: number): SurfaceBufferGeometry {
  const plan = curveCrawlerMeshPlan;
  const geometry = createSurfaceGeometry(
    plan.vertexCount * entityCapacity,
    plan.indexCount * entityCapacity,
    GeometryIndexFormat.Uint32,
  );
  geometry.commitCounts(geometry.maxVertices, geometry.maxIndices);
  copyMeshPlanIndices(plan, entityCapacity, geometry.getIndexView());
  return geometry;
}

/** 把容量余量的三角形收拢为退化点，保留固定索引同时不产生可见表面。 */
function collapseUnusedEntities(
  geometry: SurfaceBufferGeometry,
  activeEntityCount: number,
  entityCapacity: number,
): void {
  const firstUnusedVertex = activeEntityCount * curveCrawlerMeshPlan.vertexCount;
  const endVertex = entityCapacity * curveCrawlerMeshPlan.vertexCount;
  geometry.positions.fill(0, firstUnusedVertex * 3, endVertex * 3);
  geometry.normals.fill(0, firstUnusedVertex * 3, endVertex * 3);
  geometry.colors.fill(0, firstUnusedVertex * 4, endVertex * 4);
}
