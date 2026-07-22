import { type Camera, type Material, Node } from 'cc';
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
import { CurveCrawlerGpuSlotAllocator } from './curve-crawler-gpu-slot-allocator';
import { CurveCrawlerMaterials } from './curve-crawler-materials';
import { CurveCrawlerPoseSnapshot } from './curve-crawler-pose-snapshot';
import { type CurveCrawlerPopulationRendering } from './curve-crawler-population-rendering';
import { CurveCrawlerRenderCadence } from './curve-crawler-render-cadence';
import { CurveCrawlerResidentLayout } from './curve-crawler-resident-layout';
import { CurveCrawlerVisibilityLayout } from './curve-crawler-visibility-layout';
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
  readonly visibility: CurveCrawlerVisibilityLayout;
  readonly gpuSlotOffset: number;
  readonly colorSnapshot: CurveCrawlerColorSnapshot;
  readonly poseSnapshot: CurveCrawlerPoseSnapshot;
  readonly updatePlan: CurveCrawlerDirtyUpdatePlan;
  needsRewrite: boolean;
  active: boolean;
}

/**
 * 将多个独立 Curve Crawler 群体写入稳定槽位并通过可见索引共享一个 MeshRenderer。
 *
 * 休眠槽位不会占用顶点求值、GPU 上传或三角形提交；驻留实体保持完整模型，
 * 顶点流按连续脏区局部上传，索引只按生命周期压缩。
 */
export class CurveCrawlerSharedRenderer {
  private readonly materials: CurveCrawlerMaterials;
  private readonly meshEvaluator: CurveCrawlerMeshEvaluator;
  private readonly activeIndices = new CurveCrawlerActiveIndexLayout(curveCrawlerMeshPlan);
  private readonly gpuSlots = new CurveCrawlerGpuSlotAllocator();
  private readonly renderCadence = new CurveCrawlerRenderCadence();
  private readonly entries: CurveCrawlerSharedRenderEntry[] = [];
  private batch: DynamicMeshBatch | null = null;
  private geometry: UnlitColorBufferGeometry<Uint32Array> | null = null;
  private streams: VertexStreams | null = null;
  private entityCapacity = 0;
  private residentEntityCount = 0;
  private activeEntityCount = 0;
  private evaluatedEntityCount = 0;
  private positionUploadBytes = 0;
  private positionUploadCalls = 0;
  private structureDirty = false;
  private nextRenderIdentity = 1;
  private disposed = false;

  /** 当前具有可渲染生命周期并实际进入 GPU 批次的实体数量。 */
  public get visibleEntityCount(): number {
    return this.activeEntityCount;
  }

  /** 当前仍具有出生、存活或死亡演出生命周期的实体数量。 */
  public get residentCount(): number {
    return this.residentEntityCount;
  }

  /** 最近一次同步实际重新求值程序化网格的实体数量。 */
  public get lastEvaluatedEntityCount(): number {
    return this.evaluatedEntityCount;
  }

  /** 最近一次同步上传的位置流字节数。 */
  public get lastPositionUploadBytes(): number {
    return this.positionUploadBytes;
  }

  /** 最近一次同步提交的位置流局部上传调用数。 */
  public get lastPositionUploadCalls(): number {
    return this.positionUploadCalls;
  }

  /** 当前共享网格已经分配的固定 GPU 实体槽位容量。 */
  public get renderCapacity(): number {
    return this.entityCapacity;
  }

  constructor(
    private readonly parent: Node,
    surfaceMaterialTemplate: Material,
    private readonly camera: Camera,
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
    const gpuSlotOffset = this.gpuSlots.allocate(state.count);
    const entry: CurveCrawlerSharedRenderEntry = {
      renderIdentity: this.nextRenderIdentity++,
      state,
      residents: new CurveCrawlerResidentLayout(state.count),
      visibility: new CurveCrawlerVisibilityLayout(state.count),
      gpuSlotOffset,
      colorSnapshot: new CurveCrawlerColorSnapshot(state),
      poseSnapshot: new CurveCrawlerPoseSnapshot(state.count),
      updatePlan: new CurveCrawlerDirtyUpdatePlan(state.count),
      needsRewrite: true,
      active: true,
    };
    this.entries.push(entry);
    this.structureDirty = true;
    return new CurveCrawlerSharedRenderHandle(this, entry);
  }

  /** 每帧只求值真实驻留实体，并上传连续脏区与紧凑索引前缀。 */
  public synchronize(deltaTime: number): void {
    this.ensureActive();
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new Error('Curve Crawler 共享渲染同步帧时间必须是有限非负数值。');
    }
    this.evaluatedEntityCount = 0;
    this.positionUploadBytes = 0;
    this.positionUploadCalls = 0;
    this.synchronizeResidentLayouts();
    const residentCount = this.countResidentEntities();
    this.synchronizeVisibilityLayouts();
    const visibleCount = this.countVisibleEntities();
    this.renderCadence.advance(deltaTime, this.gpuSlots.requiredCapacity);

    if (visibleCount === 0) {
      this.synchronizeEmptyLayout(residentCount);
      return;
    }

    const requiresGrowth = this.batch === null
      || this.geometry === null
      || this.streams === null
      || this.gpuSlots.requiredCapacity > this.entityCapacity;
    const nextCapacity = requiresGrowth
      ? getExpandedEntityCapacity(this.gpuSlots.requiredCapacity)
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

    const forceRewrite = requiresGrowth;
    this.evaluateEntries(streams, forceRewrite, !requiresGrowth);
    const indicesChanged = this.activeIndices.synchronize(
      this.entries,
      geometry.index,
      nextCapacity,
      requiresGrowth || this.structureDirty,
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
    this.residentEntityCount = residentCount;
    this.activeEntityCount = visibleCount;
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
    this.residentEntityCount = 0;
    this.activeEntityCount = 0;
    this.materials.dispose();
  }

  /** 从共享布局移除群体；实际紧凑重排推迟到统一同步点。 */
  public unregister(entry: CurveCrawlerSharedRenderEntry): void {
    if (this.disposed || !entry.active) {
      return;
    }
    entry.active = false;
    this.gpuSlots.release(entry.gpuSlotOffset, entry.state.count);
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

  /** 用刷新后的底层相机视锥同步全部群体的逐实体可见性。 */
  private synchronizeVisibilityLayouts(): void {
    const renderCamera = this.camera.camera;
    renderCamera.update(true);
    const worldMatrix = this.parent.worldMatrix;
    const worldScale = this.parent.worldScale;
    const maximumWorldScale = Math.max(
      Math.abs(worldScale.x),
      Math.abs(worldScale.y),
      Math.abs(worldScale.z),
    );
    for (const entry of this.entries) {
      entry.visibility.synchronize(
        entry.state,
        entry.residents,
        worldMatrix,
        maximumWorldScale,
        renderCamera.frustum,
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

  /** 返回所有独立群体当前通过相机视锥测试的实体数。 */
  private countVisibleEntities(): number {
    let count = 0;
    for (const entry of this.entries) {
      count += entry.visibility.count;
    }
    return count;
  }

  /** 在没有任何驻留实体时完全移除怪物 Draw Call。 */
  private synchronizeEmptyLayout(residentCount: number): void {
    this.batch?.setActiveIndexCount(0);
    this.batch?.setVisible(false);
    this.residentEntityCount = residentCount;
    this.activeEntityCount = 0;
    this.structureDirty = false;
  }

  /** 按群体顺序写连续 GPU 区段；法线与颜色只在布局或颜色事件变化时刷新。 */
  private evaluateEntries(
    streams: VertexStreams,
    forceRewrite: boolean,
    uploadRanges: boolean,
  ): void {
    for (const entry of this.entries) {
      entry.updatePlan.schedule(
        entry.state,
        entry.visibility,
        entry.gpuSlotOffset,
        this.renderCadence,
        entry.poseSnapshot,
        entry.colorSnapshot,
        forceRewrite || entry.needsRewrite,
      );
      this.meshEvaluator.evaluateScheduledToEntitySlots(
        entry.state,
        curveCrawlerMeshPlan,
        streams,
        entry.visibility.entityIndices,
        entry.updatePlan.updates,
        entry.visibility.count,
        entry.gpuSlotOffset,
      );
      shadeScheduledCurveCrawlerUnlitEntities(
        streams,
        curveCrawlerMeshPlan,
        entry.gpuSlotOffset,
        entry.visibility.entityIndices,
        entry.visibility.count,
        entry.updatePlan.updates,
      );
      this.countScheduledEvaluations(entry.updatePlan.updates, entry.visibility.count);
      if (uploadRanges) {
        this.uploadScheduledAttributeRanges(
          entry.visibility.entityIndices,
          entry.updatePlan.updates,
          entry.visibility.count,
          entry.gpuSlotOffset,
          CurveCrawlerPackedMeshUpdate.Position,
          MeshDirty.Position,
        );
        this.uploadScheduledAttributeRanges(
          entry.visibility.entityIndices,
          entry.updatePlan.updates,
          entry.visibility.count,
          entry.gpuSlotOffset,
          CurveCrawlerPackedMeshUpdate.Shaded,
          MeshDirty.Color,
        );
      }
      entry.needsRewrite = false;
    }
  }

  /** 合并连续实体脏区并提交单个顶点属性范围。 */
  private uploadScheduledAttributeRanges(
    entityIndices: Uint32Array,
    updates: Uint8Array,
    entityCount: number,
    gpuSlotOffset: number,
    minimumUpdate: CurveCrawlerPackedMeshUpdate,
    attribute: MeshDirty,
  ): void {
    if (this.batch === null) {
      throw new Error('Curve Crawler 脏区上传缺少动态网格批次。');
    }
    let rangeStartSlot = -1;
    let previousSlot = -2;
    for (let packedIndex = 0; packedIndex <= entityCount; packedIndex++) {
      const dirty = packedIndex < entityCount
        && (updates[packedIndex] ?? CurveCrawlerPackedMeshUpdate.None) >= minimumUpdate;
      const entityIndex = packedIndex < entityCount ? entityIndices[packedIndex] : undefined;
      const gpuSlot = entityIndex === undefined ? -1 : gpuSlotOffset + entityIndex;
      const continuesRange = dirty && rangeStartSlot >= 0 && gpuSlot === previousSlot + 1;
      if (dirty && rangeStartSlot < 0) {
        rangeStartSlot = gpuSlot;
      } else if (!continuesRange && rangeStartSlot >= 0) {
        const dirtyEntityCount = previousSlot - rangeStartSlot + 1;
        this.batch.uploadVertexAttributeRange(
          attribute,
          rangeStartSlot * curveCrawlerMeshPlan.vertexCount,
          dirtyEntityCount * curveCrawlerMeshPlan.vertexCount,
        );
        if (attribute === MeshDirty.Position) {
          this.positionUploadCalls++;
          this.positionUploadBytes += dirtyEntityCount
            * curveCrawlerMeshPlan.vertexCount
            * 3
            * Float32Array.BYTES_PER_ELEMENT;
        }
        rangeStartSlot = dirty ? gpuSlot : -1;
      }
      previousSlot = dirty ? gpuSlot : -2;
    }
  }

  /** 汇总本帧真正执行的逐实体网格求值数量。 */
  private countScheduledEvaluations(updates: Uint8Array, entityCount: number): void {
    for (let index = 0; index < entityCount; index++) {
      if ((updates[index] ?? CurveCrawlerPackedMeshUpdate.None)
        !== CurveCrawlerPackedMeshUpdate.None) {
        this.evaluatedEntityCount++;
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
        entry.needsRewrite = true;
      }
      throw error;
    }
    this.batch?.dispose();
    this.batch = nextBatch;
    this.geometry = geometry;
    this.streams = streams;
    this.entityCapacity = entityCapacity;
    this.positionUploadCalls = 1;
    this.positionUploadBytes = entityCapacity
      * curveCrawlerMeshPlan.vertexCount
      * 3
      * Float32Array.BYTES_PER_ELEMENT;
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
    // 共享渲染器在统一同步点比较逐实体姿态快照，无需把整个群体标脏。
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
