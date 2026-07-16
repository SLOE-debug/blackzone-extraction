import { type Material, Node } from 'cc';
import {
  createStaticSurfaceGeometry,
  GeometryIndexFormat,
} from '../../core/geometry/buffer-geometry';
import { TriangleMeshWriter } from '../../core/geometry/triangle-mesh-writer';
import {
  StaticSurfaceMesh,
  type StaticSurfaceMeshOptions,
} from '../../core/rendering/static-surface-mesh';
import {
  lobbyGlowGeometry,
  lobbyOpaqueGeometry,
} from '../geometry/lobby-opaque-geometry';
import { LobbyMaterials } from './lobby-materials';
import { lobbyGlowVertexShading, lobbyVertexShading } from './lobby-vertex-shading';

const SHADOWED_SURFACE_OPTIONS: StaticSurfaceMeshOptions = Object.freeze({
  castShadows: true,
  receiveShadows: true,
});

const UNSHADOWED_SURFACE_OPTIONS: StaticSurfaceMeshOptions = Object.freeze({
  castShadows: false,
  receiveShadows: false,
});

/** 使用自定义顶点流、真实法线和 Cocos 内置材质渲染大厅。 */
export class LobbyRenderer {
  private readonly materials: LobbyMaterials;
  private readonly surfaceMesh = new StaticSurfaceMesh();
  private readonly glowMesh = new StaticSurfaceMesh();
  private disposed = false;

  constructor(parent: Node, surfaceMaterialTemplate: Material) {
    this.materials = new LobbyMaterials(surfaceMaterialTemplate);
    try {
      const opaqueGeometry = createStaticSurfaceGeometry(
        lobbyOpaqueGeometry.metrics.verticesPerEntity,
        lobbyOpaqueGeometry.metrics.indicesPerEntity,
        GeometryIndexFormat.Uint16,
      );
      const opaqueWriter = new TriangleMeshWriter(opaqueGeometry);
      opaqueWriter.reset(true);
      const sectionRanges = lobbyOpaqueGeometry.write(opaqueWriter);
      opaqueWriter.commit();
      lobbyVertexShading.update(opaqueGeometry, sectionRanges);
      this.surfaceMesh.initialize(
        parent,
        'LobbyOpaqueSurface',
        opaqueGeometry,
        this.materials.surface,
        SHADOWED_SURFACE_OPTIONS,
      );

      const glowGeometry = createStaticSurfaceGeometry(
        lobbyGlowGeometry.metrics.verticesPerEntity,
        lobbyGlowGeometry.metrics.indicesPerEntity,
        GeometryIndexFormat.Uint16,
      );
      const glowWriter = new TriangleMeshWriter(glowGeometry);
      glowWriter.reset(true);
      lobbyGlowGeometry.write(glowWriter);
      glowWriter.commit();
      lobbyGlowVertexShading.update(glowGeometry);
      this.glowMesh.initialize(
        parent,
        'LobbyLampGlow',
        glowGeometry,
        this.materials.glow,
        UNSHADOWED_SURFACE_OPTIONS,
      );
    } catch (error: unknown) {
      this.dispose();
      throw error;
    }
  }

  /** 先释放静态网格，再释放其引用的运行时材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.glowMesh.dispose();
    this.surfaceMesh.dispose();
    this.materials.dispose();
    this.disposed = true;
  }
}
