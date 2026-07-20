import { Color, type Material, Node } from 'cc';
import { type Disposable } from '../../../../core/contracts/disposable';
import {
  type MutableGeometryBounds,
  type SurfaceBufferGeometry,
  type UnlitColorBufferGeometry,
  writePositionBounds,
} from '../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../core/mesh/mesh-dirty';
import { DynamicMeshBatch } from '../../../../core/rendering/dynamic-mesh-batch';
import { StandardVertexColorMaterialFactory } from '../../../../core/rendering/standard-vertex-color-material-factory';
import {
  evaluateTreasureChestAttention,
  TREASURE_CHEST_ATTENTION,
  type MutableTreasureChestAttentionSample,
} from '../animation/treasure-chest-attention';
import {
  createTreasureChestBatchGeometry,
  type TreasureChestBatchGeometry,
  writeTreasureChestLidPose,
} from '../geometry/treasure-chest-batch-geometry';
import {
  createTreasureChestBeaconGeometry,
  writeTreasureChestBeaconGeometry,
} from '../geometry/treasure-chest-beacon-geometry';
import { type BattlefieldTreasureChestSpawn } from '../model/battlefield-treasure-chest-spawn';
import { createTreasureChestBeaconMaterial } from './treasure-chest-beacon-material';
import {
  collapseSharedTreasureChestBeacons,
  collapseSharedTreasureChestBodies,
  createSharedTreasureChestBeaconGeometry,
  createSharedTreasureChestBodyGeometry,
  writeSharedTreasureChestBeacon,
  writeSharedTreasureChestBody,
} from './treasure-chest-shared-geometry';

const CHEST_SURFACE_OPTIONS = Object.freeze({
  castShadows: true,
  receiveShadows: true,
});
const BEACON_OPTIONS = Object.freeze({
  castShadows: false,
  receiveShadows: false,
});

/** 任意数量活动宝箱固定只占用箱体与信标两个三维渲染批次。 */
export const TREASURE_CHEST_SHARED_BATCH_COUNT = 2;

/** 单个宝箱运行时持有的共享渲染区段句柄。 */
export interface TreasureChestRenderHandle extends Disposable {
  setLidAngleDegrees(angle: number): void;
  updateAttention(elapsed: number, playerDistanceSquared: number, active: boolean): void;
}

interface TreasureChestRenderEntry {
  readonly spawn: Readonly<BattlefieldTreasureChestSpawn>;
  readonly attention: MutableTreasureChestAttentionSample;
  lidAngleDegrees: number;
  sampledAttentionTime: number;
  signalStrength: number;
  lastAttentionSampleIndex: number;
  attentionActive: boolean;
  bodyDirty: boolean;
  beaconDirty: boolean;
  active: boolean;
}

/** 将全部活动 Chunk 的宝箱压入一个箱体批次和一个信标批次。 */
export class TreasureChestSharedRenderer implements Disposable {
  private readonly bodySource: TreasureChestBatchGeometry = createTreasureChestBatchGeometry();
  private readonly beaconSource = createTreasureChestBeaconGeometry();
  private readonly bodyMaterial: Material;
  private readonly beaconMaterial: Material;
  private readonly entries: TreasureChestRenderEntry[] = [];
  private readonly bodyBounds: MutableGeometryBounds = createEmptyBounds();
  private readonly beaconBounds: MutableGeometryBounds = createEmptyBounds();
  private bodyBatch: DynamicMeshBatch | null = null;
  private beaconBatch: DynamicMeshBatch | null = null;
  private bodyGeometry: SurfaceBufferGeometry | null = null;
  private beaconGeometry: UnlitColorBufferGeometry | null = null;
  private capacity = 0;
  private activeCount = 0;
  private structureDirty = false;
  private disposed = false;

  constructor(
    private readonly parent: Node,
    surfaceMaterialTemplate: Material,
  ) {
    let bodyMaterial: Material | null = null;
    let beaconMaterial: Material | null = null;
    try {
      bodyMaterial = StandardVertexColorMaterialFactory.create(surfaceMaterialTemplate, {
        name: 'TreasureChestSharedSurfaceMaterial',
        mainColor: new Color(255, 255, 255, 255),
        roughness: 0.72,
        metallic: 0.14,
        specularIntensity: 0.4,
        emissive: new Color(11, 4, 1, 255),
      });
      beaconMaterial = createTreasureChestBeaconMaterial();
      this.bodyMaterial = bodyMaterial;
      this.beaconMaterial = beaconMaterial;
    } catch (error: unknown) {
      beaconMaterial?.destroy();
      bodyMaterial?.destroy();
      throw error;
    }
  }

  /** 登记一个宝箱的固定世界变换，并返回只操作该区段的句柄。 */
  public register(
    spawn: Readonly<BattlefieldTreasureChestSpawn>,
  ): TreasureChestRenderHandle {
    this.ensureActive();
    const attention: MutableTreasureChestAttentionSample = {
      signalStrength: 0,
      proximity: 0,
      pulse: 0,
    };
    evaluateTreasureChestAttention(
      0,
      TREASURE_CHEST_ATTENTION.awarenessRadius * TREASURE_CHEST_ATTENTION.awarenessRadius,
      true,
      attention,
    );
    const entry: TreasureChestRenderEntry = {
      spawn,
      attention,
      lidAngleDegrees: 0,
      sampledAttentionTime: 0,
      signalStrength: attention.signalStrength,
      lastAttentionSampleIndex: 0,
      attentionActive: true,
      bodyDirty: true,
      beaconDirty: true,
      active: true,
    };
    this.entries.push(entry);
    this.structureDirty = true;
    return new SharedTreasureChestRenderHandle(this, entry);
  }

  /** 在全部宝箱完成动画求值后统一写流并最多提交两个 MeshRenderer。 */
  public synchronize(): void {
    this.ensureActive();
    const count = this.entries.length;
    if (count === 0) {
      this.bodyBatch?.setVisible(false);
      this.beaconBatch?.setVisible(false);
      this.activeCount = 0;
      this.structureDirty = false;
      return;
    }

    const requiresGrowth = this.bodyBatch === null
      || this.beaconBatch === null
      || this.bodyGeometry === null
      || this.beaconGeometry === null
      || count > this.capacity;
    const nextCapacity = requiresGrowth ? expandedCapacity(count) : this.capacity;
    let bodyGeometry: SurfaceBufferGeometry;
    let beaconGeometry: UnlitColorBufferGeometry;
    if (requiresGrowth) {
      bodyGeometry = createSharedTreasureChestBodyGeometry(
        this.bodySource,
        nextCapacity,
      );
      beaconGeometry = createSharedTreasureChestBeaconGeometry(
        this.beaconSource,
        nextCapacity,
      );
    } else {
      if (this.bodyGeometry === null || this.beaconGeometry === null) {
        throw new Error('共享宝箱批次在容量复用时缺少几何。');
      }
      bodyGeometry = this.bodyGeometry;
      beaconGeometry = this.beaconGeometry;
    }

    const forceRewrite = requiresGrowth
      || this.structureDirty
      || count !== this.activeCount;
    let bodyChanged = forceRewrite;
    let beaconChanged = forceRewrite;
    let anyBeaconVisible = false;
    for (let slot = 0; slot < count; slot++) {
      const entry = this.entries[slot];
      if (entry === undefined) {
        throw new Error('共享宝箱渲染槽位缺失。');
      }
      if (forceRewrite || entry.bodyDirty) {
        writeTreasureChestLidPose(this.bodySource, entry.lidAngleDegrees);
        writeSharedTreasureChestBody(
          this.bodySource,
          bodyGeometry,
          slot,
          entry.spawn.x,
          entry.spawn.y,
          entry.spawn.z,
          entry.spawn.heading,
          forceRewrite,
        );
        bodyChanged = true;
      }
      if (forceRewrite || entry.beaconDirty) {
        writeTreasureChestBeaconGeometry(
          this.beaconSource,
          entry.sampledAttentionTime,
          entry.signalStrength,
        );
        writeSharedTreasureChestBeacon(
          this.beaconSource,
          beaconGeometry,
          slot,
          entry.spawn.x,
          entry.spawn.y,
          entry.spawn.z,
          entry.spawn.heading,
        );
        beaconChanged = true;
      }
      anyBeaconVisible ||= entry.attentionActive;
      entry.bodyDirty = false;
      entry.beaconDirty = false;
    }

    if (forceRewrite) {
      collapseSharedTreasureChestBodies(
        bodyGeometry,
        this.bodySource.geometry.vertexCount,
        count,
      );
      collapseSharedTreasureChestBeacons(
        beaconGeometry,
        this.beaconSource.vertexCount,
        count,
      );
    }
    if (bodyChanged) {
      writePositionBounds(bodyGeometry.positions, this.bodyBounds);
    }
    if (beaconChanged) {
      writePositionBounds(beaconGeometry.positions, this.beaconBounds);
    }

    if (requiresGrowth) {
      this.replaceBatches(bodyGeometry, beaconGeometry, nextCapacity);
    } else {
      if (bodyChanged) {
        this.bodyBatch?.uploadVertexAttributes(
          forceRewrite ? MeshDirty.All : MeshDirty.Pose,
        );
        this.bodyBatch?.updateBounds(this.bodyBounds);
      }
      if (beaconChanged) {
        this.beaconBatch?.uploadVertexAttributes(MeshDirty.Position | MeshDirty.Color);
        this.beaconBatch?.updateBounds(this.beaconBounds);
      }
    }
    this.bodyBatch?.setVisible(true);
    this.beaconBatch?.setVisible(anyBeaconVisible);
    this.activeCount = count;
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
    this.beaconBatch?.dispose();
    this.bodyBatch?.dispose();
    this.beaconBatch = null;
    this.bodyBatch = null;
    this.beaconGeometry = null;
    this.bodyGeometry = null;
    this.beaconMaterial.destroy();
    this.bodyMaterial.destroy();
  }

  public setLidAngle(entry: TreasureChestRenderEntry, angle: number): void {
    if (!entry.active || this.disposed || !Number.isFinite(angle)) {
      return;
    }
    if (entry.lidAngleDegrees !== angle) {
      entry.lidAngleDegrees = angle;
      entry.bodyDirty = true;
    }
  }

  public updateAttention(
    entry: TreasureChestRenderEntry,
    elapsed: number,
    playerDistanceSquared: number,
    active: boolean,
  ): void {
    if (!entry.active || this.disposed || (!active && !entry.attentionActive)) {
      return;
    }
    const sampleIndex = Math.floor(elapsed * TREASURE_CHEST_ATTENTION.samplesPerSecond);
    if (sampleIndex === entry.lastAttentionSampleIndex
      && active === entry.attentionActive) {
      return;
    }
    const sampledTime = sampleIndex / TREASURE_CHEST_ATTENTION.samplesPerSecond;
    evaluateTreasureChestAttention(
      sampledTime,
      playerDistanceSquared,
      active,
      entry.attention,
    );
    entry.lastAttentionSampleIndex = sampleIndex;
    entry.attentionActive = active;
    entry.sampledAttentionTime = sampledTime;
    entry.signalStrength = entry.attention.signalStrength;
    entry.beaconDirty = true;
  }

  public unregister(entry: TreasureChestRenderEntry): void {
    if (!entry.active || this.disposed) {
      return;
    }
    entry.active = false;
    const index = this.entries.indexOf(entry);
    if (index >= 0) {
      this.entries.splice(index, 1);
      this.structureDirty = true;
    }
  }

  private replaceBatches(
    bodyGeometry: SurfaceBufferGeometry,
    beaconGeometry: UnlitColorBufferGeometry,
    capacity: number,
  ): void {
    const nextBodyBatch = new DynamicMeshBatch();
    const nextBeaconBatch = new DynamicMeshBatch();
    try {
      nextBodyBatch.initialize(
        this.parent,
        'TreasureChestSharedBodyBatch',
        bodyGeometry,
        this.bodyMaterial,
        this.bodyBounds,
        CHEST_SURFACE_OPTIONS,
      );
      nextBeaconBatch.initialize(
        this.parent,
        'TreasureChestSharedBeaconBatch',
        beaconGeometry,
        this.beaconMaterial,
        this.beaconBounds,
        BEACON_OPTIONS,
      );
    } catch (error: unknown) {
      nextBeaconBatch.dispose();
      nextBodyBatch.dispose();
      for (const entry of this.entries) {
        entry.bodyDirty = true;
        entry.beaconDirty = true;
      }
      throw error;
    }
    this.beaconBatch?.dispose();
    this.bodyBatch?.dispose();
    this.bodyBatch = nextBodyBatch;
    this.beaconBatch = nextBeaconBatch;
    this.bodyGeometry = bodyGeometry;
    this.beaconGeometry = beaconGeometry;
    this.capacity = capacity;
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('共享宝箱渲染器已经释放。');
    }
  }
}

class SharedTreasureChestRenderHandle implements TreasureChestRenderHandle {
  constructor(
    private readonly owner: TreasureChestSharedRenderer,
    private readonly entry: TreasureChestRenderEntry,
  ) {}

  public setLidAngleDegrees(angle: number): void {
    this.owner.setLidAngle(this.entry, angle);
  }

  public updateAttention(
    elapsed: number,
    playerDistanceSquared: number,
    active: boolean,
  ): void {
    this.owner.updateAttention(this.entry, elapsed, playerDistanceSquared, active);
  }

  public dispose(): void {
    this.owner.unregister(this.entry);
  }
}

function expandedCapacity(count: number): number {
  let capacity = 1;
  while (capacity < count) {
    capacity *= 2;
  }
  return capacity;
}

function createEmptyBounds(): MutableGeometryBounds {
  return {
    minX: 0,
    minY: 0,
    minZ: 0,
    maxX: 0,
    maxY: 0,
    maxZ: 0,
  };
}
