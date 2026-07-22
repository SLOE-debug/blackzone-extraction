import { type Material, Node } from 'cc';
import {
  UnlitColorBufferGeometry,
} from '../../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../../core/mesh/mesh-dirty';
import { type VertexStreams } from '../../../../../core/mesh/vertex-streams';
import { DynamicMeshBatch } from '../../../../../core/rendering/dynamic-mesh-batch';
import { curveCrawlerMeshPlan } from '../geometry/curve-crawler-mesh-compiler';
import { CurveCrawlerMeshEvaluator } from '../geometry/curve-crawler-mesh-evaluator';
import { CurveCrawlerPackedMeshUpdate } from '../geometry/curve-crawler-packed-mesh-update';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { CurveCrawlerRenderMode } from '../model/curve-crawler-render-mode';
import {
  CurveCrawlerActiveIndexLayout,
  type CurveCrawlerActiveIndexSource,
} from './curve-crawler-active-index-layout';
import { CurveCrawlerColorSnapshot } from './curve-crawler-color-snapshot';
import { CurveCrawlerDirtyUpdatePlan } from './curve-crawler-dirty-update-plan';
import { CurveCrawlerMaterials } from './curve-crawler-materials';
import { type CurveCrawlerPopulationRendering } from './curve-crawler-population-rendering';
import { CurveCrawlerResidentLayout } from './curve-crawler-resident-layout';
import {
  shadeScheduledCurveCrawlerUnlitEntities,
} from './curve-crawler-unlit-vertex-shading';

const SHARED_SURFACE_OPTIONS = Object.freeze({
  castShadows: false,
  receiveShadows: false,
});
const SHARED_BOUNDS = Object.freeze({
  minX: -1_000_000,
  minY: -1_000_000,
  minZ: -32,
  maxX: 1_000_000,
  maxY: 1_000_000,
  maxZ: 512,
});

interface CurveCrawlerSharedRenderEntry extends CurveCrawlerActiveIndexSource {
  readonly renderIdentity: number;
  readonly state: CurveCrawlerState;
  readonly residents: CurveCrawlerResidentLayout;
  readonly colorSnapshot: CurveCrawlerColorSnapshot;
  readonly updatePlan: CurveCrawlerDirtyUpdatePlan;
  dirty: boolean;
  active: boolean;
}

/**
 * 将多个独立 Curve Crawler 群体的真实驻留实体紧凑压入一个动态 MeshRenderer。
 *
 * 休眠槽位不会占用顶点求值、GPU 上传或三角形提交；驻留实体保持完整模型，
 * 顶点流按连续脏区局部上传，索引只按生命周期压缩。
 */
export class CurveCrawlerSharedRenderer {
  private readonly materials: CurveCrawlerMaterials;
  private readonly meshEvaluator: CurveCrawlerMeshEvaluator;
  private readonly activeIndices = new CurveCrawlerActiveIndexLayout(curveCrawlerMeshPlan);
  private readonly entries: CurveCrawlerSharedRenderEntry[] = [];
  private batch: DynamicMeshBatch | null = null;
  private geometry: UnlitColorBufferGeometry<Uint32Array> | null = null;
  private streams: VertexStreams | null = null;
  private entityCapacity = 0;
  private activeEntityCount = 0;
  private structureDirty = false;
  private nextRenderIdentity = 1;
  private disposed = false;

  /** 当前具有可渲染生命周期并实际进入 GPU 批次的实体数量。 */
  public get visibleEntityCount(): number {
    return this.activeEntityCount;
  }

  /** 当前共享网格可容纳的紧凑驻留实体数量。 */
  public get renderCapacity(): number {
    return this.entityCapacity;
  }

  constructor(
    private readonly parent: Node,
    surfaceMaterialTemplate: Material,
  ) {
    this.meshEvaluator = new CurveCrawlerMeshEvaluator(curveCrawlerMeshPlan, true);
    this.materials = new CurveCrawlerMaterials(
      surfaceMaterialTemplate,
      CurveCrawlerRenderMode.Unlit,
    );
  }

  /** 登记一个独立模拟状态，并返回只控制该状态的轻量句柄。 */
  public register(state: CurveCrawlerState): CurveCrawlerPopulationRendering {
    this.ensureActive();
    const entry: CurveCrawlerSharedRenderEntry = {
      renderIdentity: this.nextRenderIdentity++,
      state,
      residents: new CurveCrawlerResidentLayout(state.count),
      colorSnapshot: new CurveCrawlerColorSnapshot(state),
      updatePlan: new CurveCrawlerDirtyUpdatePlan(state.count),
      dirty: true,
      active: true,
    };
    this.entries.push(entry);
    this.structureDirty = true;
    return new CurveCrawlerSharedRenderHandle(this, entry);
  }

  /** 每帧只求值真实驻留实体，并上传连续脏区与紧凑索引前缀。 */
  public synchronize(): void {
    this.ensureActive();
    const residentLayoutChanged = this.synchronizeResidentLayouts();
    this.synchronizeColorSnapshots();
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
    let geometry: UnlitColorBufferGeometry<Uint32Array>;
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
    this.evaluateEntries(streams, forceRewrite, !requiresGrowth);
    const indicesChanged = this.activeIndices.synchronize(
      this.entries,
      geometry.index,
      nextCapacity,
      requiresGrowth,
    );
    const activeIndexCount = this.activeIndices.indexCount;

    if (requiresGrowth) {
      this.replaceBatch(geometry, streams, nextCapacity);
    } else {
      if (indicesChanged) {
        this.batch?.uploadIndices(activeIndexCount);
      }
    }
    if (requiresGrowth || !indicesChanged) {
      this.batch?.setActiveIndexCount(activeIndexCount);
    }
    this.batch?.setVisible(activeIndexCount > 0);
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

  /** 原地同步全部群体的可渲染生命周期槽位。 */
  private synchronizeResidentLayouts(): boolean {
    let changed = false;
    for (const entry of this.entries) {
      changed = entry.residents.synchronize(entry.state) || changed;
    }
    return changed;
  }

  /** 只比较驻留实体的受击与死亡液体颜色输入。 */
  private synchronizeColorSnapshots(): void {
    for (const entry of this.entries) {
      entry.colorSnapshot.captureResident(
        entry.residents.entityIndices,
        entry.residents.count,
      );
    }
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

  /** 按群体顺序写连续 GPU 区段；法线与颜色只在布局或颜色事件变化时刷新。 */
  private evaluateEntries(
    streams: VertexStreams,
    forceRewrite: boolean,
    uploadRanges: boolean,
  ): void {
    let targetEntityOffset = 0;
    for (const entry of this.entries) {
      entry.updatePlan.schedule(
        entry.state,
        entry.residents,
        entry.colorSnapshot,
        entry.dirty,
        forceRewrite,
      );
      this.meshEvaluator.evaluatePackedScheduled(
        entry.state,
        curveCrawlerMeshPlan,
        streams,
        entry.residents.entityIndices,
        entry.updatePlan.updates,
        entry.residents.count,
        targetEntityOffset,
      );
      shadeScheduledCurveCrawlerUnlitEntities(
        streams,
        curveCrawlerMeshPlan,
        targetEntityOffset,
        entry.residents.count,
        entry.updatePlan.updates,
      );
      if (uploadRanges) {
        this.uploadScheduledAttributeRanges(
          entry.updatePlan.updates,
          entry.residents.count,
          targetEntityOffset,
          CurveCrawlerPackedMeshUpdate.Position,
          MeshDirty.Position,
        );
        this.uploadScheduledAttributeRanges(
          entry.updatePlan.updates,
          entry.residents.count,
          targetEntityOffset,
          CurveCrawlerPackedMeshUpdate.Shaded,
          MeshDirty.Color,
        );
      }
      targetEntityOffset += entry.residents.count;
      entry.dirty = false;
    }
  }

  /** 合并连续实体脏区并提交单个顶点属性范围。 */
  private uploadScheduledAttributeRanges(
    updates: Uint8Array,
    entityCount: number,
    targetEntityOffset: number,
    minimumUpdate: CurveCrawlerPackedMeshUpdate,
    attribute: MeshDirty,
  ): void {
    if (this.batch === null) {
      throw new Error('Curve Crawler 脏区上传缺少动态网格批次。');
    }
    let rangeStart = -1;
    for (let packedIndex = 0; packedIndex <= entityCount; packedIndex++) {
      const dirty = packedIndex < entityCount
        && (updates[packedIndex] ?? CurveCrawlerPackedMeshUpdate.None) >= minimumUpdate;
      if (dirty && rangeStart < 0) {
        rangeStart = packedIndex;
      } else if (!dirty && rangeStart >= 0) {
        const firstEntity = targetEntityOffset + rangeStart;
        const dirtyEntityCount = packedIndex - rangeStart;
        this.batch.uploadVertexAttributeRange(
          attribute,
          firstEntity * curveCrawlerMeshPlan.vertexCount,
          dirtyEntityCount * curveCrawlerMeshPlan.vertexCount,
        );
        rangeStart = -1;
      }
    }
  }

  /** 成功创建更大批次后再替换旧 GPU 资源，避免失败时提前丢失画面。 */
  private replaceBatch(
    geometry: UnlitColorBufferGeometry<Uint32Array>,
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
        SHARED_BOUNDS,
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

/** 为当前驻留人口扩展到最近的二次幂，降低波次增长时的重建频率。 */
function getExpandedEntityCapacity(entityCount: number): number {
  let capacity = 1;
  while (capacity < entityCount) {
    capacity *= 2;
  }
  return capacity;
}

/** 创建只覆盖当前驻留人口高水位的固定拓扑网格。 */
function createSharedGeometry(
  entityCapacity: number,
): UnlitColorBufferGeometry<Uint32Array> {
  const plan = curveCrawlerMeshPlan;
  const geometry = new UnlitColorBufferGeometry(
    plan.vertexCount * entityCapacity,
    plan.indexCount * entityCapacity,
    new Uint32Array(plan.indexCount * entityCapacity),
  );
  geometry.commitCounts(geometry.maxVertices, geometry.maxIndices);
  return geometry;
}

/** 为 Unlit 明暗计算补一份只保留在 CPU、不会上传 GPU 的法线流。 */
function createUnlitEvaluationStreams(geometry: UnlitColorBufferGeometry): VertexStreams {
  return Object.freeze({
    positions: geometry.positions,
    normals: new Float32Array(geometry.maxVertices * 3),
    colors: geometry.colors,
  });
}
