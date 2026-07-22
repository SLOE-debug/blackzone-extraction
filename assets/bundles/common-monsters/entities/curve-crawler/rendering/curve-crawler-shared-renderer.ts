import { type Material, Node } from 'cc';
import { type PlanarCircleVisibility } from '../../../../../core/contracts/planar-circle-visibility';
import {
  UnlitColorBufferGeometry,
} from '../../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../../core/mesh/mesh-dirty';
import { type VertexStreams } from '../../../../../core/mesh/vertex-streams';
import { DynamicMeshBatch } from '../../../../../core/rendering/dynamic-mesh-batch';
import { curveCrawlerMeshPlan } from '../geometry/curve-crawler-mesh-compiler';
import { CurveCrawlerMeshEvaluator } from '../geometry/curve-crawler-mesh-evaluator';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { CurveCrawlerRenderMode } from '../model/curve-crawler-render-mode';
import {
  CurveCrawlerActiveIndexLayout,
  type CurveCrawlerActiveIndexSource,
} from './curve-crawler-active-index-layout';
import { CurveCrawlerColorSnapshot } from './curve-crawler-color-snapshot';
import { CurveCrawlerRenderCadence } from './curve-crawler-render-cadence';
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
  readonly cadence: CurveCrawlerRenderCadence;
  dirty: boolean;
  active: boolean;
}

/**
 * 将多个独立 Curve Crawler 群体的真实驻留实体紧凑压入一个动态 MeshRenderer。
 *
 * 休眠槽位不会占用顶点求值、GPU 上传或三角形提交；可见实体继续按距离减少
 * 足端和腿部，并按生命周期压缩索引。容量只在可见人口跨过二次幂边界时增长。
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
  private frameSequence = 0;
  private disposed = false;

  /** 当前通过相机视锥筛选并实际进入 GPU 批次的实体数量。 */
  public get visibleEntityCount(): number {
    return this.activeEntityCount;
  }

  /** 当前共享网格可容纳的紧凑可见实体数量。 */
  public get renderCapacity(): number {
    return this.entityCapacity;
  }

  constructor(
    private readonly parent: Node,
    surfaceMaterialTemplate: Material,
    private readonly visibility: PlanarCircleVisibility,
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
      residents: new CurveCrawlerResidentLayout(state.count, this.visibility),
      colorSnapshot: new CurveCrawlerColorSnapshot(state),
      cadence: new CurveCrawlerRenderCadence(state.count),
      dirty: true,
      active: true,
    };
    this.entries.push(entry);
    this.structureDirty = true;
    return new CurveCrawlerSharedRenderHandle(this, entry);
  }

  /** 每帧只求值真实驻留实体，并统一上传距离 LOD 后的紧凑顶点与索引前缀。 */
  public synchronize(): void {
    this.ensureActive();
    this.frameSequence = (this.frameSequence + 1) & 0x7fffffff;
    const residentLayoutChanged = this.structureDirty || (this.frameSequence & 1) === 0
      ? this.synchronizeResidentLayouts()
      : false;
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
    const changed = this.evaluateEntries(streams, forceRewrite);
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
      const uploadChanged = getUnlitUploadDirty(changed);
      if (uploadChanged !== MeshDirty.None) {
        this.batch?.uploadVertexAttributes(
          uploadChanged,
          residentCount * curveCrawlerMeshPlan.vertexCount,
        );
      }
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

  /** 原地同步全部群体的可见生命周期槽位。 */
  private synchronizeResidentLayouts(): boolean {
    let changed = false;
    for (const entry of this.entries) {
      // 可见性同时依赖相机视锥；即使实体状态未变，相机移动也必须重新筛选。
      changed = entry.residents.synchronize(entry.state) || changed;
    }
    return changed;
  }

  /** 只比较可见实体的受击与死亡液体颜色输入。 */
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
  ): MeshDirty {
    let changed = MeshDirty.None;
    let targetEntityOffset = 0;
    for (const entry of this.entries) {
      entry.cadence.schedule(
        entry.renderIdentity,
        entry.state,
        entry.residents,
        entry.colorSnapshot,
        this.frameSequence,
        entry.dirty,
        forceRewrite,
      );
      changed |= this.meshEvaluator.evaluatePackedScheduled(
        entry.state,
        curveCrawlerMeshPlan,
        streams,
        entry.residents.entityIndices,
        entry.residents.detailLevels,
        entry.cadence.updates,
        entry.residents.count,
        targetEntityOffset,
      );
      shadeScheduledCurveCrawlerUnlitEntities(
        streams,
        curveCrawlerMeshPlan,
        targetEntityOffset,
        entry.residents.count,
        entry.cadence.updates,
      );
      targetEntityOffset += entry.residents.count;
      entry.dirty = false;
    }
    return changed;
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

/** 为当前可见人口扩展到最近的二次幂，降低波次增长时的重建频率。 */
function getExpandedEntityCapacity(entityCount: number): number {
  let capacity = 1;
  while (capacity < entityCount) {
    capacity *= 2;
  }
  return capacity;
}

/** 创建只覆盖当前可见人口高水位的固定拓扑网格。 */
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

/** 共享 Unlit 网格只向 GPU 提交 Position 与已经烘焙明暗的 Color。 */
function getUnlitUploadDirty(changed: MeshDirty): MeshDirty {
  return (changed & (MeshDirty.Position | MeshDirty.Color)) as MeshDirty;
}
