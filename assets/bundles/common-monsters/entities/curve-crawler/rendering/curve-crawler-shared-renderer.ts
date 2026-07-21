import { type Material, Node } from 'cc';
import { type PlanarCircleVisibility } from '../../../../../core/contracts/planar-circle-visibility';
import {
  createUnlitColorGeometry,
  GeometryIndexFormat,
  type UnlitColorBufferGeometry,
} from '../../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../../core/mesh/mesh-dirty';
import { copyMeshPlanIndices } from '../../../../../core/mesh/mesh-plan-indices';
import { type VertexStreams } from '../../../../../core/mesh/vertex-streams';
import { DynamicMeshBatch } from '../../../../../core/rendering/dynamic-mesh-batch';
import { curveCrawlerMeshPlan } from '../geometry/curve-crawler-mesh-compiler';
import { CurveCrawlerMeshEvaluator } from '../geometry/curve-crawler-mesh-evaluator';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { CurveCrawlerRenderMode } from '../model/curve-crawler-render-mode';
import {
  createCurveCrawlerBounds,
  type CurveCrawlerBounds,
  updateCurveCrawlerBounds,
} from './curve-crawler-bounds';
import { CurveCrawlerColorSnapshot } from './curve-crawler-color-snapshot';
import { CurveCrawlerMaterials } from './curve-crawler-materials';
import { type CurveCrawlerPopulationRendering } from './curve-crawler-population-rendering';
import { CurveCrawlerResidentLayout } from './curve-crawler-resident-layout';

const SHARED_SURFACE_OPTIONS = Object.freeze({
  castShadows: false,
  receiveShadows: false,
});
const EMPTY_NORMAL_STREAM = new Float32Array(0);

interface CurveCrawlerSharedRenderEntry {
  readonly state: CurveCrawlerState;
  readonly bounds: CurveCrawlerBounds;
  readonly colors: CurveCrawlerColorSnapshot;
  readonly residents: CurveCrawlerResidentLayout;
  dirty: boolean;
  active: boolean;
}

/**
 * 将多个独立 Curve Crawler 群体的真实驻留实体紧凑压入一个动态 MeshRenderer。
 *
 * 休眠槽位不会占用顶点求值、GPU 上传或三角形提交；容量只在可见人口跨过二次幂
 * 边界时增长，避免开局为完整尸潮上限预付持续渲染成本。
 */
export class CurveCrawlerSharedRenderer {
  private readonly materials: CurveCrawlerMaterials;
  private readonly evaluator = new CurveCrawlerMeshEvaluator(false);
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
  private geometry: UnlitColorBufferGeometry | null = null;
  private streams: VertexStreams | null = null;
  private entityCapacity = 0;
  private activeEntityCount = 0;
  private structureDirty = false;
  private disposed = false;

  /** 当前通过相机视锥筛选并实际进入 GPU 批次的实体数量。 */
  public get visibleEntityCount(): number {
    return this.activeEntityCount;
  }

  constructor(
    private readonly parent: Node,
    surfaceMaterialTemplate: Material,
    private readonly visibility: PlanarCircleVisibility,
  ) {
    this.materials = new CurveCrawlerMaterials(
      surfaceMaterialTemplate,
      CurveCrawlerRenderMode.Unlit,
    );
  }

  /** 登记一个独立模拟状态，并返回只控制该状态的轻量句柄。 */
  public register(state: CurveCrawlerState): CurveCrawlerPopulationRendering {
    this.ensureActive();
    const entry: CurveCrawlerSharedRenderEntry = {
      state,
      bounds: createCurveCrawlerBounds(state),
      colors: new CurveCrawlerColorSnapshot(state),
      residents: new CurveCrawlerResidentLayout(state.count, this.visibility),
      dirty: true,
      active: true,
    };
    this.entries.push(entry);
    this.structureDirty = true;
    return new CurveCrawlerSharedRenderHandle(this, entry);
  }

  /** 每帧只求值真实驻留实体，并统一上传紧凑后的顶点流。 */
  public synchronize(): void {
    this.ensureActive();
    const residentLayoutChanged = this.synchronizeResidentLayouts();
    const residentCount = this.countResidentEntities();
    const layoutChanged = this.structureDirty
      || residentLayoutChanged
      || residentCount !== this.activeEntityCount;

    if (residentCount === 0) {
      this.synchronizeEmptyLayout();
      return;
    }

    const requiresGrowth = this.batch === null
      || this.geometry === null
      || this.streams === null
      || residentCount > this.entityCapacity;
    const nextCapacity = requiresGrowth
      ? getExpandedEntityCapacity(residentCount)
      : this.entityCapacity;
    let geometry: UnlitColorBufferGeometry;
    let streams: VertexStreams;
    if (requiresGrowth) {
      geometry = createSharedGeometry(nextCapacity);
      streams = createUnlitEvaluationStreams(geometry);
    } else {
      if (this.geometry === null || this.streams === null) {
        throw new Error('Curve Crawler 共享几何在容量复用时不存在。');
      }
      geometry = this.geometry;
      streams = this.streams;
    }

    const forceRewrite = requiresGrowth || layoutChanged;
    const changed = this.evaluateEntries(streams, forceRewrite);
    const boundsChanged = this.updateBounds(forceRewrite);

    if (requiresGrowth) {
      this.replaceBatch(geometry, streams, nextCapacity);
    } else {
      if ((changed & (MeshDirty.Position | MeshDirty.Normal | MeshDirty.Color)) !== 0) {
        this.batch?.uploadVertexAttributes(changed);
      }
      if (boundsChanged) {
        this.batch?.updateBounds(this.bounds);
      }
    }
    this.batch?.setActiveIndexCount(
      residentCount * curveCrawlerMeshPlan.indexCount,
    );
    this.batch?.setVisible(true);
    this.activeEntityCount = residentCount;
    this.structureDirty = false;
  }

  /** 释放唯一批次与唯一材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const entry of this.entries) {
      entry.active = false;
    }
    this.entries.length = 0;
    this.batch?.dispose();
    this.batch = null;
    this.geometry = null;
    this.streams = null;
    this.entityCapacity = 0;
    this.activeEntityCount = 0;
    this.materials.dispose();
  }

  /** 标记一个群体需要在下一次统一同步时重写动态姿态。 */
  public markDirty(entry: CurveCrawlerSharedRenderEntry): void {
    if (!this.disposed && entry.active) {
      entry.dirty = true;
    }
  }

  /** 从共享布局移除群体；实际紧凑重排推迟到统一同步点。 */
  public unregister(entry: CurveCrawlerSharedRenderEntry): void {
    if (this.disposed || !entry.active) {
      return;
    }
    entry.active = false;
    const index = this.entries.indexOf(entry);
    if (index >= 0) {
      this.entries.splice(index, 1);
      this.structureDirty = true;
    }
  }

  /** 原地同步全部群体的可见生命周期槽位。 */
  private synchronizeResidentLayouts(): boolean {
    let changed = false;
    for (const entry of this.entries) {
      // 可见性同时依赖相机视锥；即使实体状态未变，相机移动也必须重新筛选。
      changed = entry.residents.synchronize(entry.state) || changed;
    }
    return changed;
  }

  /** 返回所有独立群体当前需要提交的总实体数。 */
  private countResidentEntities(): number {
    let count = 0;
    for (const entry of this.entries) {
      count += entry.residents.count;
    }
    return count;
  }

  /** 在没有任何驻留实体时完全移除怪物 Draw Call。 */
  private synchronizeEmptyLayout(): void {
    this.batch?.setActiveIndexCount(0);
    this.batch?.setVisible(false);
    for (const entry of this.entries) {
      entry.dirty = false;
    }
    this.activeEntityCount = 0;
    this.structureDirty = false;
  }

  /** 按群体顺序把离散 SoA 槽位写成一个连续 GPU 实体区段。 */
  private evaluateEntries(streams: VertexStreams, forceRewrite: boolean): MeshDirty {
    let changed = MeshDirty.None;
    let targetEntityOffset = 0;
    for (const entry of this.entries) {
      const colorChanged = entry.colors.captureResident(
        entry.residents.entityIndices,
        entry.residents.count,
      );
      if (forceRewrite || entry.dirty) {
        let requested = MeshDirty.Position;
        if (forceRewrite || colorChanged) {
          requested |= MeshDirty.Color;
        }
        changed |= this.evaluator.evaluatePacked(
          entry.state,
          curveCrawlerMeshPlan,
          streams,
          entry.residents.entityIndices,
          entry.residents.count,
          targetEntityOffset,
          requested,
        );
      }
      targetEntityOffset += entry.residents.count;
      entry.dirty = false;
    }
    return changed;
  }

  /** 成功创建更大批次后再替换旧 GPU 资源，避免失败时提前丢失画面。 */
  private replaceBatch(
    geometry: UnlitColorBufferGeometry,
    streams: VertexStreams,
    entityCapacity: number,
  ): void {
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
        entry.dirty = true;
      }
      throw error;
    }
    this.batch?.dispose();
    this.batch = nextBatch;
    this.geometry = geometry;
    this.streams = streams;
    this.entityCapacity = entityCapacity;
  }

  /** 聚合全部驻留群体的保守裁剪边界。 */
  private updateBounds(force = false): boolean {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (const entry of this.entries) {
      if (entry.residents.count === 0) {
        continue;
      }
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

/** 为当前可见人口扩展到最近的二次幂，降低波次增长时的重建频率。 */
function getExpandedEntityCapacity(entityCount: number): number {
  let capacity = 1;
  while (capacity < entityCount) {
    capacity *= 2;
  }
  return capacity;
}

/** 创建只覆盖当前可见人口高水位的固定拓扑网格。 */
function createSharedGeometry(entityCapacity: number): UnlitColorBufferGeometry {
  const plan = curveCrawlerMeshPlan;
  const geometry = createUnlitColorGeometry(
    plan.vertexCount * entityCapacity,
    plan.indexCount * entityCapacity,
    GeometryIndexFormat.Uint32,
  );
  geometry.commitCounts(geometry.maxVertices, geometry.maxIndices);
  copyMeshPlanIndices(plan, entityCapacity, geometry.getIndexView());
  return geometry;
}

/** 为通用求值器补一份不会上传 GPU 的占位法线流。 */
function createUnlitEvaluationStreams(geometry: UnlitColorBufferGeometry): VertexStreams {
  return Object.freeze({
    positions: geometry.positions,
    normals: EMPTY_NORMAL_STREAM,
    colors: geometry.colors,
  });
}
