import { Color, type Material, Node } from 'cc';
import {
  type MutableGeometryBounds,
  writePositionBounds,
} from '../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../core/mesh/mesh-dirty';
import { DynamicMeshBatch } from '../../../../core/rendering/dynamic-mesh-batch';
import { StandardVertexColorMaterialFactory } from '../../../../core/rendering/standard-vertex-color-material-factory';
import {
  createTreasureChestBatchGeometry,
  type TreasureChestBatchGeometry,
  writeTreasureChestLidPose,
} from '../geometry/treasure-chest-batch-geometry';
import { TreasureChestBeaconRenderer } from './treasure-chest-beacon-renderer';

const DEGREES_PER_RADIAN = 180 / Math.PI;
const CHEST_SURFACE_OPTIONS = Object.freeze({
  castShadows: true,
  receiveShadows: true,
});

/** 创建宝箱节点、受光材质并只接受动画系统给出的箱盖角度。 */
export class TreasureChestRenderer {
  private readonly root: Node;
  private readonly mesh = new DynamicMeshBatch();
  private readonly geometry: TreasureChestBatchGeometry;
  private readonly bounds: MutableGeometryBounds = {
    minX: 0,
    minY: 0,
    minZ: 0,
    maxX: 0,
    maxY: 0,
    maxZ: 0,
  };
  private readonly material: Material;
  private readonly beacon: TreasureChestBeaconRenderer;
  private disposed = false;

  constructor(
    parent: Node,
    surfaceMaterialTemplate: Material,
    x: number,
    y: number,
    z: number,
    heading: number,
  ) {
    const root = new Node('TreasureChest');
    parent.addChild(root);
    root.setPosition(x, y, z);
    root.setRotationFromEuler(0, heading * DEGREES_PER_RADIAN, 0);
    this.root = root;

    let material: Material | null = null;
    let beacon: TreasureChestBeaconRenderer | null = null;
    try {
      material = StandardVertexColorMaterialFactory.create(surfaceMaterialTemplate, {
        name: 'TreasureChestSurfaceMaterial',
        mainColor: new Color(255, 255, 255, 255),
        roughness: 0.72,
        metallic: 0.14,
        specularIntensity: 0.4,
        emissive: new Color(11, 4, 1, 255),
      });
      this.material = material;
      this.geometry = createTreasureChestBatchGeometry();
      writePositionBounds(this.geometry.geometry.getPositionView(), this.bounds);
      this.mesh.initialize(
        root,
        'TreasureChestBatch',
        this.geometry.geometry,
        material,
        this.bounds,
        CHEST_SURFACE_OPTIONS,
      );
      beacon = new TreasureChestBeaconRenderer(root);
      this.beacon = beacon;
    } catch (error: unknown) {
      this.disposed = true;
      beacon?.dispose();
      this.mesh.dispose();
      material?.destroy();
      if (root.isValid) {
        root.destroy();
      }
      throw error;
    }
  }

  /** 应用动画系统求值后的绕本地 X 轴箱盖角度。 */
  public setLidAngleDegrees(angle: number): void {
    if (this.disposed || !Number.isFinite(angle)) {
      return;
    }
    writeTreasureChestLidPose(this.geometry, angle);
    writePositionBounds(this.geometry.geometry.getPositionView(), this.bounds);
    this.mesh.uploadVertexAttributes(MeshDirty.Pose);
    this.mesh.updateBounds(this.bounds);
  }

  /** 更新独立信标层，宝箱本体维持稳定色彩，不再整体呼吸变色。 */
  public updateAttention(
    elapsed: number,
    playerDistanceSquared: number,
    active: boolean,
  ): void {
    if (this.disposed) {
      return;
    }
    this.beacon.update(elapsed, playerDistanceSquared, active);
  }

  /** 按 Mesh、材质、根节点的所有权顺序释放宝箱渲染资源。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.beacon.dispose();
    this.mesh.dispose();
    this.material.destroy();
    if (this.root.isValid) {
      this.root.destroy();
    }
  }
}
