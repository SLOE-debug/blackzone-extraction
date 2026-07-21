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
import { lobbyEffectsGeometry } from '../geometry/lobby-effects-geometry';
import { lobbyOpaqueGeometry } from '../geometry/lobby-opaque-geometry';
import { shadeLobbyGlass } from './lobby-effects-vertex-shading';
import { lobbyEmissiveVertexShading } from './lobby-emissive-vertex-shading';
import { LobbyMaterials } from './lobby-materials';
import { lobbyVertexShading } from './lobby-vertex-shading';

const SHADOWED_SURFACE_OPTIONS: StaticSurfaceMeshOptions = Object.freeze({
  castShadows: true,
  receiveShadows: true,
  uploadLightingAttributes: true,
});

const EMISSIVE_SURFACE_OPTIONS: StaticSurfaceMeshOptions = Object.freeze({
  castShadows: false,
  receiveShadows: false,
  uploadLightingAttributes: false,
});

const GLASS_SURFACE_OPTIONS: StaticSurfaceMeshOptions = Object.freeze({
  castShadows: false,
  receiveShadows: false,
  uploadLightingAttributes: false,
});

/** 使用真实受光表面、独立不透明发光面和透明玻璃批次渲染大厅。 */
export class LobbyRenderer {
  private readonly materials: LobbyMaterials;
  private readonly surfaceMesh = new StaticSurfaceMesh();
  private readonly emissiveMesh = new StaticSurfaceMesh();
  private readonly glassMesh = new StaticSurfaceMesh();
  private disposed = false;

  constructor(parent: Node, surfaceMaterialTemplate: Material) {
    this.materials = new LobbyMaterials(surfaceMaterialTemplate);
    try {
      const surfaceGeometry = createStaticSurfaceGeometry(
        lobbyOpaqueGeometry.metrics.verticesPerEntity,
        lobbyOpaqueGeometry.metrics.indicesPerEntity,
        GeometryIndexFormat.Uint16,
      );
      const surfaceWriter = new TriangleMeshWriter(surfaceGeometry);
      surfaceWriter.reset(true);
      const surfaceRanges = lobbyOpaqueGeometry.write(surfaceWriter);
      surfaceWriter.commit();
      lobbyVertexShading.update(surfaceGeometry, surfaceRanges);
      this.surfaceMesh.initialize(
        parent,
        'LobbyOpaqueSurface',
        surfaceGeometry,
        this.materials.surface,
        SHADOWED_SURFACE_OPTIONS,
      );

      const emissiveGeometry = createStaticSurfaceGeometry(
        lobbyEffectsGeometry.emissive.metrics.verticesPerEntity,
        lobbyEffectsGeometry.emissive.metrics.indicesPerEntity,
        GeometryIndexFormat.Uint16,
      );
      const emissiveWriter = new TriangleMeshWriter(emissiveGeometry);
      emissiveWriter.reset(true);
      const emissiveRanges = lobbyEffectsGeometry.emissive.write(emissiveWriter);
      emissiveWriter.commit();
      lobbyEmissiveVertexShading.update(emissiveGeometry, emissiveRanges);
      this.emissiveMesh.initialize(
        parent,
        'LobbyEmissiveSurface',
        emissiveGeometry,
        this.materials.emissive,
        EMISSIVE_SURFACE_OPTIONS,
      );

      const glassGeometry = createStaticSurfaceGeometry(
        lobbyEffectsGeometry.glass.metrics.verticesPerEntity,
        lobbyEffectsGeometry.glass.metrics.indicesPerEntity,
        GeometryIndexFormat.Uint16,
      );
      const glassWriter = new TriangleMeshWriter(glassGeometry);
      glassWriter.reset(true);
      lobbyEffectsGeometry.glass.write(glassWriter);
      glassWriter.commit();
      shadeLobbyGlass(glassGeometry);
      this.glassMesh.initialize(
        parent,
        'LobbyObservationGlass',
        glassGeometry,
        this.materials.glass,
        GLASS_SURFACE_OPTIONS,
      );
    } catch (error: unknown) {
      this.dispose();
      throw error;
    }
  }

  /** 先释放大厅网格，再释放其引用的运行时材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.glassMesh.dispose();
    this.emissiveMesh.dispose();
    this.surfaceMesh.dispose();
    this.materials.dispose();
    this.disposed = true;
  }
}
