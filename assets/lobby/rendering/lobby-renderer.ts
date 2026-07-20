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
import { shadeLobbyEffects } from './lobby-effects-vertex-shading';
import { LobbyMaterials } from './lobby-materials';
import { lobbyVertexShading } from './lobby-vertex-shading';

const SHADOWED_SURFACE_OPTIONS: StaticSurfaceMeshOptions = Object.freeze({
  castShadows: true,
  receiveShadows: true,
  uploadLightingAttributes: true,
});

const EFFECTS_SURFACE_OPTIONS: StaticSurfaceMeshOptions = Object.freeze({
  castShadows: false,
  receiveShadows: false,
  uploadLightingAttributes: false,
});

/** 使用真实受光表面和单一透明效果批次渲染大厅。 */
export class LobbyRenderer {
  private readonly materials: LobbyMaterials;
  private readonly surfaceMesh = new StaticSurfaceMesh();
  private readonly effectsMesh = new StaticSurfaceMesh();
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

      const effectsGeometry = createStaticSurfaceGeometry(
        lobbyEffectsGeometry.metrics.verticesPerEntity,
        lobbyEffectsGeometry.metrics.indicesPerEntity,
        GeometryIndexFormat.Uint16,
      );
      const effectsWriter = new TriangleMeshWriter(effectsGeometry);
      effectsWriter.reset(true);
      const effectsRanges = lobbyEffectsGeometry.write(effectsWriter);
      effectsWriter.commit();
      shadeLobbyEffects(effectsGeometry, effectsRanges);
      this.effectsMesh.initialize(
        parent,
        'LobbyEffectsSurface',
        effectsGeometry,
        this.materials.effects,
        EFFECTS_SURFACE_OPTIONS,
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
    this.effectsMesh.dispose();
    this.surfaceMesh.dispose();
    this.materials.dispose();
    this.disposed = true;
  }
}
