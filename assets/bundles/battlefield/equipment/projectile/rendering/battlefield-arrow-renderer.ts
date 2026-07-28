import { type Material, type Node } from 'cc';
import { MeshDirty } from '../../../../../core/mesh/mesh-dirty';
import { DynamicMeshBatch } from '../../../../../core/rendering/dynamic-mesh-batch';
import {
  BATTLEFIELD_ARROW_BATCH_VERTEX_COUNT,
  BATTLEFIELD_ARROW_VERTICES_PER_SLOT,
  BATTLEFIELD_QUIVER_VERTEX_COUNT,
  BATTLEFIELD_TETHER_LEAD_VERTICES_PER_SLOT,
  BATTLEFIELD_TETHER_MARKER_VERTICES_PER_SLOT,
  BATTLEFIELD_TETHER_VERTICES_PER_SLOT,
  createBattlefieldArrowBatchGeometry,
  writeBattlefieldArrow,
  writeBattlefieldQuiver,
  writeBattlefieldTether,
  writeBattlefieldTetherLead,
  writeBattlefieldTetherMarker,
} from '../geometry/battlefield-arrow-batch-geometry';
import { BattlefieldArrowState } from '../model/battlefield-arrow-state';
import { BATTLEFIELD_TETHER_GROUND_HEIGHT } from '../model/battlefield-tether-config';
import {
  BATTLEFIELD_ARROW_CAPACITY,
  BATTLEFIELD_PERMANENT_ARROW_CAPACITY,
  type BattlefieldArrowPopulation,
} from '../population/battlefield-arrow-population';
import {
  BATTLEFIELD_MAXIMUM_TETHER_COUNT,
  type BattlefieldArrowTetherSystem,
} from '../population/battlefield-arrow-tether-system';

const INITIAL_BOUNDS = Object.freeze({
  minX: -1,
  minY: -1,
  minZ: -1,
  maxX: 1,
  maxY: 2,
  maxZ: 1,
});
const BOUNDS_PADDING = 1.5;
const BOUNDS_EXPANSION_STEP = 8;
const UNKNOWN_VISIBILITY = 0xff;
const TETHER_LEAD_HALF_WIDTH = 0.025;

/** 用单个固定拓扑批次绘制全部箭矢、箭袋余量与弦网。 */
export class BattlefieldArrowRenderer {
  private readonly geometry = createBattlefieldArrowBatchGeometry();
  private readonly batch = new DynamicMeshBatch();
  private readonly bounds = { ...INITIAL_BOUNDS };
  private readonly arrowVisibility = new Uint8Array(BATTLEFIELD_ARROW_CAPACITY);
  private readonly arrowState = new Uint8Array(BATTLEFIELD_ARROW_CAPACITY);
  private readonly arrowUpdated = new Uint8Array(BATTLEFIELD_ARROW_CAPACITY);
  private readonly tetherVisibility = new Uint8Array(BATTLEFIELD_MAXIMUM_TETHER_COUNT);
  private readonly tetherStart = new Uint8Array(BATTLEFIELD_MAXIMUM_TETHER_COUNT);
  private readonly tetherEnd = new Uint8Array(BATTLEFIELD_MAXIMUM_TETHER_COUNT);
  private readonly leadVisibility = new Uint8Array(BATTLEFIELD_PERMANENT_ARROW_CAPACITY);
  private readonly markerVisibility = new Uint8Array(BATTLEFIELD_PERMANENT_ARROW_CAPACITY);
  private previousOwnerX = Number.NaN;
  private previousOwnerY = Number.NaN;
  private previousOwnerZ = Number.NaN;
  private previousOwnerHeading = Number.NaN;
  private previousProjectileOriginX = Number.NaN;
  private previousProjectileOriginY = Number.NaN;
  private previousProjectileOriginZ = Number.NaN;
  private disposed = false;

  constructor(parent: Node, material: Material) {
    this.batch.initialize(parent, 'BattlefieldArrowBatch', this.geometry, material, INITIAL_BOUNDS, {
      castShadows: false,
      receiveShadows: false,
    });
    this.arrowVisibility.fill(UNKNOWN_VISIBILITY);
    this.arrowState.fill(UNKNOWN_VISIBILITY);
    this.tetherVisibility.fill(UNKNOWN_VISIBILITY);
    this.tetherStart.fill(UNKNOWN_VISIBILITY);
    this.tetherEnd.fill(UNKNOWN_VISIBILITY);
    this.leadVisibility.fill(UNKNOWN_VISIBILITY);
    this.markerVisibility.fill(UNKNOWN_VISIBILITY);
  }

  public synchronize(
    arrows: BattlefieldArrowPopulation,
    tethers: BattlefieldArrowTetherSystem,
    ownerX: number,
    ownerY: number,
    ownerZ: number,
    ownerHeading: number,
    projectileOriginX: number,
    projectileOriginY: number,
    projectileOriginZ: number,
  ): void {
    if (this.disposed) {
      return;
    }
    const forwardX = Math.sin(ownerHeading);
    const forwardZ = Math.cos(ownerHeading);
    const rightX = forwardZ;
    const rightZ = -forwardX;
    const ownerChanged = ownerX !== this.previousOwnerX
      || ownerY !== this.previousOwnerY
      || ownerZ !== this.previousOwnerZ
      || ownerHeading !== this.previousOwnerHeading;
    const projectileOriginChanged = projectileOriginX !== this.previousProjectileOriginX
      || projectileOriginY !== this.previousProjectileOriginY
      || projectileOriginZ !== this.previousProjectileOriginZ;
    let minimumPositionDirty = BATTLEFIELD_ARROW_BATCH_VERTEX_COUNT;
    let maximumPositionDirty = 0;
    let minimumColorDirty = BATTLEFIELD_ARROW_BATCH_VERTEX_COUNT;
    let maximumColorDirty = 0;
    let minimumX = ownerX;
    let minimumY = ownerY;
    let minimumZ = ownerZ;
    let maximumX = ownerX;
    let maximumY = ownerY + 3.1;
    let maximumZ = ownerZ;
    for (let index = 0; index < BATTLEFIELD_ARROW_CAPACITY; index++) {
      const active = arrows.active[index] !== 0;
      const state = arrows.state[index] as BattlefieldArrowState;
      const ready = state === BattlefieldArrowState.Ready;
      const drawing = state === BattlefieldArrowState.Drawing;
      const quiverOffset = index - (BATTLEFIELD_PERMANENT_ARROW_CAPACITY - 1) * 0.5;
      const x = drawing
        ? projectileOriginX
        : ready
          ? ownerX - forwardX * 0.42 + rightX * quiverOffset * 0.065
          : arrows.positionX[index] ?? 0;
      const y = drawing
        ? projectileOriginY
        : ready
          ? ownerY + 2.96 + Math.abs(quiverOffset) * 0.018
          : arrows.positionY[index] ?? 0;
      const z = drawing
        ? projectileOriginZ
        : ready
          ? ownerZ - forwardZ * 0.42 + rightZ * quiverOffset * 0.065
          : arrows.positionZ[index] ?? 0;
      if (active) {
        minimumX = Math.min(minimumX, x);
        minimumY = Math.min(minimumY, y);
        minimumZ = Math.min(minimumZ, z);
        maximumX = Math.max(maximumX, x);
        maximumY = Math.max(maximumY, y);
        maximumZ = Math.max(maximumZ, z);
      }
      const visibility = Number(active);
      const visibilityChanged = this.arrowVisibility[index] !== visibility;
      const stateChanged = this.arrowState[index] !== state;
      const shouldWrite = visibilityChanged
        || stateChanged
        || arrows.dirty[index] !== 0
        || (ready && ownerChanged)
        || (drawing && (ownerChanged || projectileOriginChanged));
      if (shouldWrite) {
        writeBattlefieldArrow(
          this.geometry,
          index,
          x,
          y,
          z,
          drawing ? forwardX : ready ? 0.06 * rightX : arrows.directionX[index] ?? 0,
          ready ? 1 : drawing ? 0 : arrows.directionY[index] ?? 0,
          drawing ? forwardZ : ready ? 0.06 * rightZ : arrows.directionZ[index] ?? 1,
          active,
          ready || drawing ? 1 : calculateArrowVisualScale(x, z, ownerX, ownerZ),
        );
        const first = index * BATTLEFIELD_ARROW_VERTICES_PER_SLOT;
        minimumPositionDirty = Math.min(minimumPositionDirty, first);
        maximumPositionDirty = Math.max(
          maximumPositionDirty,
          first + BATTLEFIELD_ARROW_VERTICES_PER_SLOT,
        );
        this.arrowUpdated[index] = 1;
      } else {
        this.arrowUpdated[index] = 0;
      }
      if (visibilityChanged) {
        const first = index * BATTLEFIELD_ARROW_VERTICES_PER_SLOT;
        minimumColorDirty = Math.min(minimumColorDirty, first);
        maximumColorDirty = Math.max(
          maximumColorDirty,
          first + BATTLEFIELD_ARROW_VERTICES_PER_SLOT,
        );
      }
      this.arrowVisibility[index] = visibility;
      this.arrowState[index] = state;
      arrows.dirty[index] = 0;
    }
    const tetherY = ownerY + BATTLEFIELD_TETHER_GROUND_HEIGHT;
    for (let edge = 0; edge < BATTLEFIELD_MAXIMUM_TETHER_COUNT; edge++) {
      const active = tethers.active && edge < tethers.tetherCount;
      const start = tethers.startArrowIndex[edge] ?? 0;
      const end = tethers.endArrowIndex[edge] ?? 0;
      const startX = arrows.positionX[start] ?? ownerX;
      const startZ = arrows.positionZ[start] ?? ownerZ;
      const endX = arrows.positionX[end] ?? ownerX;
      const endZ = arrows.positionZ[end] ?? ownerZ;
      const visibility = Number(active);
      const visibilityChanged = this.tetherVisibility[edge] !== visibility;
      const anchorsChanged = this.tetherStart[edge] !== start || this.tetherEnd[edge] !== end;
      if (visibilityChanged || anchorsChanged || (active
        && (this.arrowUpdated[start] !== 0 || this.arrowUpdated[end] !== 0 || ownerChanged))) {
        writeBattlefieldTether(
          this.geometry,
          edge,
          startX,
          tetherY,
          startZ,
          endX,
          tetherY,
          endZ,
          active,
          calculateTetherHalfWidth(
            (startX + endX) * 0.5,
            (startZ + endZ) * 0.5,
            ownerX,
            ownerZ,
          ),
        );
        const first = BATTLEFIELD_ARROW_CAPACITY * BATTLEFIELD_ARROW_VERTICES_PER_SLOT
          + edge * BATTLEFIELD_TETHER_VERTICES_PER_SLOT;
        minimumPositionDirty = Math.min(minimumPositionDirty, first);
        maximumPositionDirty = Math.max(
          maximumPositionDirty,
          first + BATTLEFIELD_TETHER_VERTICES_PER_SLOT,
        );
        if (visibilityChanged) {
          minimumColorDirty = Math.min(minimumColorDirty, first);
          maximumColorDirty = Math.max(
            maximumColorDirty,
            first + BATTLEFIELD_TETHER_VERTICES_PER_SLOT,
          );
        }
      }
      this.tetherVisibility[edge] = visibility;
      this.tetherStart[edge] = start;
      this.tetherEnd[edge] = end;
    }
    for (let index = 0; index < BATTLEFIELD_PERMANENT_ARROW_CAPACITY; index++) {
      const state = arrows.state[index] as BattlefieldArrowState;
      const visible = tethers.active && (state === BattlefieldArrowState.EmbeddedInMonster
        || state === BattlefieldArrowState.EmbeddedInWorld);
      const leadVisible = tethers.active && state === BattlefieldArrowState.EmbeddedInMonster;
      const leadVisibility = Number(leadVisible);
      const leadVisibilityChanged = this.leadVisibility[index] !== leadVisibility;
      const visibility = Number(visible);
      const visibilityChanged = this.markerVisibility[index] !== visibility;
      if (leadVisibilityChanged || (leadVisible
        && (this.arrowUpdated[index] !== 0 || ownerChanged))) {
        writeBattlefieldTetherLead(
          this.geometry,
          index,
          arrows.positionX[index] ?? ownerX,
          arrows.positionY[index] ?? tetherY,
          tetherY,
          arrows.positionZ[index] ?? ownerZ,
          leadVisible,
          TETHER_LEAD_HALF_WIDTH,
        );
        const first = BATTLEFIELD_ARROW_CAPACITY * BATTLEFIELD_ARROW_VERTICES_PER_SLOT
          + BATTLEFIELD_MAXIMUM_TETHER_COUNT * BATTLEFIELD_TETHER_VERTICES_PER_SLOT
          + index * BATTLEFIELD_TETHER_LEAD_VERTICES_PER_SLOT;
        minimumPositionDirty = Math.min(minimumPositionDirty, first);
        maximumPositionDirty = Math.max(
          maximumPositionDirty,
          first + BATTLEFIELD_TETHER_LEAD_VERTICES_PER_SLOT,
        );
        if (leadVisibilityChanged) {
          minimumColorDirty = Math.min(minimumColorDirty, first);
          maximumColorDirty = Math.max(
            maximumColorDirty,
            first + BATTLEFIELD_TETHER_LEAD_VERTICES_PER_SLOT,
          );
        }
      }
      if (visibilityChanged || (visible && this.arrowUpdated[index] !== 0)) {
        writeBattlefieldTetherMarker(
          this.geometry,
          index,
          arrows.positionX[index] ?? ownerX,
          arrows.positionY[index] ?? ownerY,
          arrows.positionZ[index] ?? ownerZ,
          visible,
        );
        const first = BATTLEFIELD_ARROW_CAPACITY * BATTLEFIELD_ARROW_VERTICES_PER_SLOT
          + BATTLEFIELD_MAXIMUM_TETHER_COUNT * BATTLEFIELD_TETHER_VERTICES_PER_SLOT
          + BATTLEFIELD_PERMANENT_ARROW_CAPACITY * BATTLEFIELD_TETHER_LEAD_VERTICES_PER_SLOT
          + index * BATTLEFIELD_TETHER_MARKER_VERTICES_PER_SLOT;
        minimumPositionDirty = Math.min(minimumPositionDirty, first);
        maximumPositionDirty = Math.max(
          maximumPositionDirty,
          first + BATTLEFIELD_TETHER_MARKER_VERTICES_PER_SLOT,
        );
        if (visibilityChanged) {
          minimumColorDirty = Math.min(minimumColorDirty, first);
          maximumColorDirty = Math.max(
            maximumColorDirty,
            first + BATTLEFIELD_TETHER_MARKER_VERTICES_PER_SLOT,
          );
        }
      }
      this.leadVisibility[index] = leadVisibility;
      this.markerVisibility[index] = visibility;
    }
    if (ownerChanged) {
      writeBattlefieldQuiver(
        this.geometry,
        ownerX - forwardX * 0.43,
        ownerY + 1.9,
        ownerZ - forwardZ * 0.43,
        rightX,
        rightZ,
        forwardX,
        forwardZ,
      );
      const first = BATTLEFIELD_ARROW_BATCH_VERTEX_COUNT - BATTLEFIELD_QUIVER_VERTEX_COUNT;
      minimumPositionDirty = Math.min(minimumPositionDirty, first);
      maximumPositionDirty = BATTLEFIELD_ARROW_BATCH_VERTEX_COUNT;
      if (!Number.isFinite(this.previousOwnerX)) {
        minimumColorDirty = Math.min(minimumColorDirty, first);
        maximumColorDirty = BATTLEFIELD_ARROW_BATCH_VERTEX_COUNT;
      }
    }
    uploadDirtyRange(
      this.batch,
      MeshDirty.Position,
      minimumPositionDirty,
      maximumPositionDirty,
    );
    uploadDirtyRange(this.batch, MeshDirty.Color, minimumColorDirty, maximumColorDirty);
    this.expandBounds(
      minimumX - BOUNDS_PADDING,
      minimumY - BOUNDS_PADDING,
      minimumZ - BOUNDS_PADDING,
      maximumX + BOUNDS_PADDING,
      maximumY + BOUNDS_PADDING,
      maximumZ + BOUNDS_PADDING,
    );
    this.batch.setVisible(true);
    this.previousOwnerX = ownerX;
    this.previousOwnerY = ownerY;
    this.previousOwnerZ = ownerZ;
    this.previousOwnerHeading = ownerHeading;
    this.previousProjectileOriginX = projectileOriginX;
    this.previousProjectileOriginY = projectileOriginY;
    this.previousProjectileOriginZ = projectileOriginZ;
  }

  /** 只在活动内容越过既有边界时扩张，禁止瞄准期间逐帧触发模型重建通知。 */
  private expandBounds(
    minimumX: number,
    minimumY: number,
    minimumZ: number,
    maximumX: number,
    maximumY: number,
    maximumZ: number,
  ): void {
    const bounds = this.bounds;
    if (minimumX >= bounds.minX && minimumY >= bounds.minY && minimumZ >= bounds.minZ
      && maximumX <= bounds.maxX && maximumY <= bounds.maxY && maximumZ <= bounds.maxZ) {
      return;
    }
    bounds.minX = Math.min(bounds.minX, floorBounds(minimumX));
    bounds.minY = Math.min(bounds.minY, floorBounds(minimumY));
    bounds.minZ = Math.min(bounds.minZ, floorBounds(minimumZ));
    bounds.maxX = Math.max(bounds.maxX, ceilBounds(maximumX));
    bounds.maxY = Math.max(bounds.maxY, ceilBounds(maximumY));
    bounds.maxZ = Math.max(bounds.maxZ, ceilBounds(maximumZ));
    this.batch.updateBounds(bounds);
  }

  public dispose(): void {
    if (!this.disposed) {
      this.disposed = true;
      this.batch.dispose();
    }
  }
}

function uploadDirtyRange(
  batch: DynamicMeshBatch,
  dirty: MeshDirty,
  minimumVertex: number,
  maximumVertex: number,
): void {
  if (maximumVertex > minimumVertex) {
    batch.uploadVertexAttributeRange(dirty, minimumVertex, maximumVertex - minimumVertex);
  }
}

function floorBounds(value: number): number {
  return Math.floor(value / BOUNDS_EXPANSION_STEP) * BOUNDS_EXPANSION_STEP;
}

function ceilBounds(value: number): number {
  return Math.ceil(value / BOUNDS_EXPANSION_STEP) * BOUNDS_EXPANSION_STEP;
}

function calculateArrowVisualScale(x: number, z: number, ownerX: number, ownerZ: number): number {
  return 1 + Math.min(1, Math.hypot(x - ownerX, z - ownerZ) / 24) * 0.5;
}

function calculateTetherHalfWidth(
  x: number,
  z: number,
  ownerX: number,
  ownerZ: number,
): number {
  return 0.03 + Math.min(1, Math.hypot(x - ownerX, z - ownerZ) / 24) * 0.05;
}
