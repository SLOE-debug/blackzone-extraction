import { type Material, Node } from 'cc';
import {
  createStaticSurfaceGeometry,
  GeometryIndexFormat,
} from '../../../core/geometry/buffer-geometry';
import { TriangleMeshWriter } from '../../../core/geometry/triangle-mesh-writer';
import {
  StaticSurfaceMesh,
  type StaticSurfaceMeshOptions,
} from '../../../core/rendering/static-surface-mesh';
import { battlefieldGroundGeometry } from '../geometry/battlefield-ground-geometry';
import { BattlefieldMaterials } from './battlefield-materials';
import { shadeBattlefieldGround } from './battlefield-vertex-shading';

const GROUND_SURFACE_OPTIONS: StaticSurfaceMeshOptions = Object.freeze({
  castShadows: false,
  receiveShadows: true,
  uploadLightingAttributes: true,
});

/** 创建战场程序化岩地并管理对应 GPU 资源。 */
export class BattlefieldRenderer {
  private readonly materials: BattlefieldMaterials;
  private readonly groundMesh = new StaticSurfaceMesh();
  private disposed = false;

  constructor(parent: Node, surfaceMaterialTemplate: Material) {
    this.materials = new BattlefieldMaterials(surfaceMaterialTemplate);
    try {
      const metrics = battlefieldGroundGeometry.metrics;
      const geometry = createStaticSurfaceGeometry(
        metrics.verticesPerEntity,
        metrics.indicesPerEntity,
        GeometryIndexFormat.Uint16,
      );
      const writer = new TriangleMeshWriter(geometry);
      writer.reset(true);
      battlefieldGroundGeometry.write(writer);
      writer.commit();
      shadeBattlefieldGround(geometry);
      this.groundMesh.initialize(
        parent,
        'BattlefieldGround',
        geometry,
        this.materials.ground,
        GROUND_SURFACE_OPTIONS,
      );
    } catch (error: unknown) {
      this.dispose();
      throw error;
    }
  }

  /** 先释放战场网格，再释放材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.groundMesh.dispose();
    this.materials.dispose();
    this.disposed = true;
  }
}
