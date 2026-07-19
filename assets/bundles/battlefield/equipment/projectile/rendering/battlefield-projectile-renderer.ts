import { Color, type Material, Node } from 'cc';
import {
  createSurfaceGeometry,
  GeometryIndexFormat,
  type SurfaceBufferGeometry,
} from '../../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../../core/mesh/mesh-dirty';
import { DynamicMeshBatch } from '../../../../../core/rendering/dynamic-mesh-batch';
import { TransparentUnlitMaterialFactory } from '../../../../../core/rendering/transparent-unlit-material-factory';
import {
  BATTLEFIELD_PROJECTILE_TOPOLOGY,
  initializeBattlefieldProjectileGeometry,
  writeBattlefieldProjectilePositions,
} from '../geometry/battlefield-projectile-geometry';
import { type BattlefieldProjectileState } from '../model/battlefield-projectile-state';

interface MutableProjectileBounds {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

const BOUNDS_PADDING = 0.5;

/** 使用一个固定索引动态批次渲染全部存活子弹。 */
export class BattlefieldProjectileRenderer {
  private readonly geometry: SurfaceBufferGeometry;
  private readonly material: Material;
  private readonly batch = new DynamicMeshBatch();
  private readonly bounds: MutableProjectileBounds = {
    minX: -BOUNDS_PADDING,
    minY: -BOUNDS_PADDING,
    minZ: -BOUNDS_PADDING,
    maxX: BOUNDS_PADDING,
    maxY: BOUNDS_PADDING,
    maxZ: BOUNDS_PADDING,
  };
  private disposed = false;

  constructor(parent: Node, private readonly state: BattlefieldProjectileState) {
    const topology = BATTLEFIELD_PROJECTILE_TOPOLOGY;
    this.geometry = createSurfaceGeometry(
      topology.verticesPerProjectile * state.capacity,
      topology.indicesPerProjectile * state.capacity,
      GeometryIndexFormat.Uint16,
    );
    initializeBattlefieldProjectileGeometry(this.geometry, state.capacity);
    this.material = TransparentUnlitMaterialFactory.create({
      name: 'BattlefieldProjectileGlow',
      mainColor: new Color(255, 255, 255, 255),
      useVertexColor: true,
    });
    try {
      this.batch.initialize(
        parent,
        'BattlefieldProjectileBatch',
        this.geometry,
        this.material,
        this.bounds,
        Object.freeze({
          uploadLightingAttributes: false,
          castShadows: false,
          receiveShadows: false,
        }),
      );
    } catch (error: unknown) {
      this.batch.dispose();
      this.material.destroy();
      throw error;
    }
  }

  /** 重写活动子弹位置流，并提交包围全部活动槽位的裁剪边界。 */
  public update(): void {
    if (this.disposed) {
      return;
    }
    writeBattlefieldProjectilePositions(this.state, this.geometry.positions);
    this.updateBounds();
    this.batch.uploadVertexAttributes(MeshDirty.Position);
    this.batch.updateBounds(this.bounds);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.batch.dispose();
    this.material.destroy();
  }

  private updateBounds(): void {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (let slot = 0; slot < this.state.capacity; slot++) {
      if ((this.state.active[slot] ?? 0) === 0) {
        continue;
      }
      const x = this.state.x[slot] ?? 0;
      const y = this.state.y[slot] ?? 0;
      const z = this.state.z[slot] ?? 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
    if (minX === Number.POSITIVE_INFINITY) {
      minX = 0;
      minY = 0;
      minZ = 0;
      maxX = 0;
      maxY = 0;
      maxZ = 0;
    }
    this.bounds.minX = minX - BOUNDS_PADDING;
    this.bounds.minY = minY - BOUNDS_PADDING;
    this.bounds.minZ = minZ - BOUNDS_PADDING;
    this.bounds.maxX = maxX + BOUNDS_PADDING;
    this.bounds.maxY = maxY + BOUNDS_PADDING;
    this.bounds.maxZ = maxZ + BOUNDS_PADDING;
  }
}
