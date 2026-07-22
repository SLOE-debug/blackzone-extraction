import { type Camera, type EffectAsset, Node } from 'cc';
import { StableRangeAllocator } from '../../../../../core/rendering/dynamic-entities/stable-range-allocator';
import { CurveCrawlerGpuGeometry } from '../geometry/curve-crawler-gpu-geometry';
import { curveCrawlerMeshPlan } from '../geometry/curve-crawler-mesh-compiler';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import {
  CurveCrawlerActiveIndexLayout,
  type CurveCrawlerActiveIndexSource,
} from './curve-crawler-active-index-layout';
import { CurveCrawlerGpuMaterial } from './gpu/curve-crawler-gpu-material';
import { CurveCrawlerGpuMeshBatch } from './gpu/curve-crawler-gpu-mesh-batch';
import { CurveCrawlerGpuPoseTexture } from './gpu/curve-crawler-gpu-pose-texture';
import { type CurveCrawlerPopulationRendering } from './curve-crawler-population-rendering';
import { CurveCrawlerResidentLayout } from './curve-crawler-resident-layout';
import { CurveCrawlerVisibilityLayout } from './curve-crawler-visibility-layout';

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
  readonly visibilityCulling: CurveCrawlerVisibilityLayout;
  readonly gpuSlotOffset: number;
  active: boolean;
}

/**
 * 通过静态局部 Bind Pose、每实体姿态纹理和 Vertex Shader 驱动全部共享蜘蛛。
 *
 * CPU 逐帧只打包固定数量的实体参数与活动索引；Position/Normal 顶点流只在批次结构
 * 创建或变化时生成一次，Shader 对二者执行同源变换并在当前法线上计算分档光照。
 */
export class CurveCrawlerSharedRenderer {
  private readonly activeIndices = new CurveCrawlerActiveIndexLayout(curveCrawlerMeshPlan);
  private readonly gpuSlots = new StableRangeAllocator();
  private readonly poseTexture = new CurveCrawlerGpuPoseTexture();
  private readonly material: CurveCrawlerGpuMaterial;
  private readonly entries: CurveCrawlerSharedRenderEntry[] = [];
  private batch: CurveCrawlerGpuMeshBatch | null = null;
  private geometry: CurveCrawlerGpuGeometry | null = null;
  private entityCapacity = 0;
  private residentEntityCount = 0;
  private activeEntityCount = 0;
  private poseUploadBytes = 0;
  private poseUploadCalls = 0;
  private structureDirty = false;
  private nextRenderIdentity = 1;
  private disposed = false;

  public get visibleEntityCount(): number {
    return this.activeEntityCount;
  }

  public get residentCount(): number {
    return this.residentEntityCount;
  }

  /** 最近一次同步上传的 GPU 姿态参数字节数。 */
  public get lastPoseUploadBytes(): number {
    return this.poseUploadBytes;
  }

  /** 最近一次同步提交的 GPU 姿态纹理上传次数。 */
  public get lastPoseUploadCalls(): number {
    return this.poseUploadCalls;
  }

  public get renderCapacity(): number {
    return this.entityCapacity;
  }

  constructor(
    private readonly parent: Node,
    gpuEffect: EffectAsset,
    private readonly camera: Camera,
  ) {
    try {
      this.material = new CurveCrawlerGpuMaterial(gpuEffect, this.poseTexture.asset, 1);
    } catch (error: unknown) {
      this.poseTexture.dispose();
      throw error;
    }
  }

  /** 登记一个独立模拟状态，并返回只控制该状态的轻量句柄。 */
  public register(state: CurveCrawlerState): CurveCrawlerPopulationRendering {
    this.ensureActive();
    const gpuSlotOffset = this.gpuSlots.allocate(state.count);
    const visibilityCulling = new CurveCrawlerVisibilityLayout(state.count);
    const entry: CurveCrawlerSharedRenderEntry = {
      renderIdentity: this.nextRenderIdentity++,
      state,
      residents: new CurveCrawlerResidentLayout(state.count),
      visibilityCulling,
      visibility: visibilityCulling.entities,
      gpuSlotOffset,
      active: true,
    };
    this.entries.push(entry);
    this.structureDirty = true;
    return new CurveCrawlerSharedRenderHandle(this, entry);
  }

  /** 每帧上传实体参数；只有结构或可见拓扑变化时才重建顶点或索引。 */
  public synchronize(deltaTime: number): void {
    this.ensureActive();
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new Error('Curve Crawler GPU 共享渲染同步帧时间必须是有限非负数值。');
    }
    this.poseUploadBytes = 0;
    this.poseUploadCalls = 0;
    this.synchronizeResidentLayouts();
    const residentCount = this.countResidentEntities();
    this.synchronizeVisibilityLayouts();
    const visibleCount = this.countVisibleEntities();
    if (visibleCount === 0) {
      this.batch?.setActiveIndexCount(0);
      this.batch?.setVisible(false);
      this.residentEntityCount = residentCount;
      this.activeEntityCount = 0;
      return;
    }

    const requiredCapacity = this.gpuSlots.requiredCapacity;
    const requiresGrowth = this.batch === null || requiredCapacity > this.entityCapacity;
    const requiresRebuild = requiresGrowth || this.structureDirty || this.geometry === null;
    const nextCapacity = requiresGrowth
      ? getExpandedEntityCapacity(requiredCapacity)
      : this.entityCapacity;
    const geometry = requiresRebuild
      ? new CurveCrawlerGpuGeometry(nextCapacity, curveCrawlerMeshPlan, this.entries)
      : this.geometry;
    if (geometry === null) {
      throw new Error('Curve Crawler GPU 共享几何不存在。');
    }

    const indicesChanged = this.activeIndices.synchronize(
      this.entries,
      geometry.index,
      nextCapacity,
      requiresRebuild,
    );
    if (this.poseTexture.resize(nextCapacity)) {
      this.material.setPoseTexture(this.poseTexture.asset, nextCapacity);
    }
    this.uploadPoseTexture();
    const activeIndexCount = this.activeIndices.indexCount;
    if (requiresRebuild) {
      this.replaceBatch(geometry, activeIndexCount);
    } else if (indicesChanged) {
      this.batch?.uploadIndices(activeIndexCount);
    } else {
      this.batch?.setActiveIndexCount(activeIndexCount);
    }
    this.batch?.setVisible(activeIndexCount > 0);
    this.residentEntityCount = residentCount;
    this.activeEntityCount = visibleCount;
    this.structureDirty = false;
  }

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
    this.material.dispose();
    this.poseTexture.dispose();
    this.batch = null;
    this.geometry = null;
    this.entityCapacity = 0;
    this.residentEntityCount = 0;
    this.activeEntityCount = 0;
  }

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

  private synchronizeResidentLayouts(): void {
    for (const entry of this.entries) {
      entry.residents.synchronize(entry.state);
    }
  }

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
      entry.visibilityCulling.synchronize(
        entry.state,
        entry.residents,
        worldMatrix,
        maximumWorldScale,
        renderCamera.frustum,
      );
    }
  }

  private countResidentEntities(): number {
    let count = 0;
    for (const entry of this.entries) {
      count += entry.residents.count;
    }
    return count;
  }

  private countVisibleEntities(): number {
    let count = 0;
    for (const entry of this.entries) {
      count += entry.visibility.count;
    }
    return count;
  }

  /** 把全部稳定槽位参数整体提交到 RGBA32F 纹理。 */
  private uploadPoseTexture(): void {
    this.poseTexture.begin();
    for (const entry of this.entries) {
      this.poseTexture.writeState(entry.state, entry.gpuSlotOffset);
    }
    this.poseUploadBytes = this.poseTexture.upload();
    this.poseUploadCalls = 1;
    for (const entry of this.entries) {
      entry.state.renderChanges.clearAll();
    }
  }

  private replaceBatch(geometry: CurveCrawlerGpuGeometry, activeIndexCount: number): void {
    const nextBatch = new CurveCrawlerGpuMeshBatch();
    try {
      nextBatch.initialize(
        this.parent,
        geometry,
        this.material.surface,
        SHARED_BOUNDS,
        activeIndexCount,
      );
    } catch (error: unknown) {
      nextBatch.dispose();
      throw error;
    }
    this.batch?.dispose();
    this.batch = nextBatch;
    this.geometry = geometry;
    this.entityCapacity = geometry.entityCapacity;
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('Curve Crawler GPU 共享渲染器已经释放。');
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
    // 共享 GPU 渲染器在统一同步点读取 SoA 姿态参数。
  }

  public dispose(): void {
    this.owner.unregister(this.entry);
  }
}

function getExpandedEntityCapacity(entityCount: number): number {
  let capacity = 1;
  while (capacity < entityCount) {
    capacity *= 2;
  }
  return capacity;
}
