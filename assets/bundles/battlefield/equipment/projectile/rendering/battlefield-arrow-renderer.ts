import { type Material, type Node } from 'cc';
import { MeshDirty } from '../../../../../core/mesh/mesh-dirty';
import { DynamicMeshBatch } from '../../../../../core/rendering/dynamic-mesh-batch';
import {
  BATTLEFIELD_ARROW_BATCH_VERTEX_COUNT,
  createBattlefieldArrowBatchGeometry,
  writeBattlefieldArrow,
  writeBattlefieldQuiver,
  writeBattlefieldTether,
  writeBattlefieldTetherMarker,
} from '../geometry/battlefield-arrow-batch-geometry';
import { BattlefieldArrowState } from '../model/battlefield-arrow-state';
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

/** 用单个固定拓扑批次绘制全部箭矢、箭袋余量与弦网。 */
export class BattlefieldArrowRenderer {
  private readonly geometry = createBattlefieldArrowBatchGeometry();
  private readonly batch = new DynamicMeshBatch();
  private readonly bounds = { ...INITIAL_BOUNDS };
  private disposed = false;

  constructor(parent: Node, material: Material) {
    this.batch.initialize(parent, 'BattlefieldArrowBatch', this.geometry, material, INITIAL_BOUNDS, {
      castShadows: false,
      receiveShadows: false,
    });
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
    let minimumX = ownerX;
    let minimumY = ownerY;
    let minimumZ = ownerZ;
    let maximumX = ownerX;
    let maximumY = ownerY + 3.1;
    let maximumZ = ownerZ;
    for (let index = 0; index < BATTLEFIELD_ARROW_CAPACITY; index++) {
      const active = arrows.active[index] !== 0;
      const ready = arrows.state[index] === BattlefieldArrowState.Ready;
      const drawing = arrows.state[index] === BattlefieldArrowState.Drawing;
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
      arrows.dirty[index] = 0;
    }
    for (let edge = 0; edge < BATTLEFIELD_MAXIMUM_TETHER_COUNT; edge++) {
      const active = tethers.active && edge < tethers.tetherCount;
      const start = tethers.startArrowIndex[edge] ?? 0;
      const end = tethers.endArrowIndex[edge] ?? 0;
      const startX = arrows.positionX[start] ?? ownerX;
      const startY = arrows.positionY[start] ?? ownerY;
      const startZ = arrows.positionZ[start] ?? ownerZ;
      const endX = arrows.positionX[end] ?? ownerX;
      const endY = arrows.positionY[end] ?? ownerY;
      const endZ = arrows.positionZ[end] ?? ownerZ;
      writeBattlefieldTether(
        this.geometry,
        edge,
        startX,
        startY,
        startZ,
        endX,
        endY,
        endZ,
        active,
        calculateTetherHalfWidth(
          (startX + endX) * 0.5,
          (startZ + endZ) * 0.5,
          ownerX,
          ownerZ,
        ),
      );
    }
    for (let index = 0; index < BATTLEFIELD_PERMANENT_ARROW_CAPACITY; index++) {
      const state = arrows.state[index] as BattlefieldArrowState;
      writeBattlefieldTetherMarker(
        this.geometry,
        index,
        arrows.positionX[index] ?? ownerX,
        arrows.positionY[index] ?? ownerY,
        arrows.positionZ[index] ?? ownerZ,
        tethers.active && (state === BattlefieldArrowState.EmbeddedInMonster
          || state === BattlefieldArrowState.EmbeddedInWorld),
      );
    }
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
    this.batch.uploadVertexAttributes(
      MeshDirty.Position | MeshDirty.Color,
      BATTLEFIELD_ARROW_BATCH_VERTEX_COUNT,
    );
    this.expandBounds(
      minimumX - BOUNDS_PADDING,
      minimumY - BOUNDS_PADDING,
      minimumZ - BOUNDS_PADDING,
      maximumX + BOUNDS_PADDING,
      maximumY + BOUNDS_PADDING,
      maximumZ + BOUNDS_PADDING,
    );
    this.batch.setVisible(true);
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
    bounds.minX = Math.min(bounds.minX, minimumX);
    bounds.minY = Math.min(bounds.minY, minimumY);
    bounds.minZ = Math.min(bounds.minZ, minimumZ);
    bounds.maxX = Math.max(bounds.maxX, maximumX);
    bounds.maxY = Math.max(bounds.maxY, maximumY);
    bounds.maxZ = Math.max(bounds.maxZ, maximumZ);
    this.batch.updateBounds(bounds);
  }

  public dispose(): void {
    if (!this.disposed) {
      this.disposed = true;
      this.batch.dispose();
    }
  }
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
