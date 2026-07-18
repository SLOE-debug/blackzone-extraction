import { type Material, Node } from 'cc';
import {
  createSurfaceGeometry,
  GeometryIndexFormat,
  type SurfaceBufferGeometry,
} from '../../../core/geometry/buffer-geometry';
import { TriangleMeshWriter } from '../../../core/geometry/triangle-mesh-writer';
import { MeshDirty } from '../../../core/mesh/mesh-dirty';
import {
  DynamicMeshBatch,
  type DynamicMeshBatchOptions,
} from '../../../core/rendering/dynamic-mesh-batch';
import { battlefieldGroundGeometry } from '../geometry/battlefield-ground-geometry';
import { BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG } from '../environment/model/battlefield-environment-config';
import { worldCoordinateToEnvironmentChunk } from '../environment/model/battlefield-environment-chunk';
import { BattlefieldMaterials } from './battlefield-materials';
import { shadeBattlefieldGround } from './battlefield-vertex-shading';

const GROUND_SURFACE_OPTIONS: DynamicMeshBatchOptions = Object.freeze({
  castShadows: false,
  receiveShadows: false,
  uploadLightingAttributes: true,
});

/** 创建战场程序化岩地并管理对应 GPU 资源。 */
export class BattlefieldRenderer {
  private readonly materials: BattlefieldMaterials;
  private readonly groundGeometry: SurfaceBufferGeometry;
  private readonly groundWriter: TriangleMeshWriter;
  private readonly groundMesh = new DynamicMeshBatch();
  private readonly groundRoot: Node;
  private centerChunkX = 0;
  private centerChunkZ = 0;
  private disposed = false;

  constructor(parent: Node, surfaceMaterialTemplate: Material) {
    this.materials = new BattlefieldMaterials(surfaceMaterialTemplate);
    this.groundRoot = new Node('BattlefieldGroundRoot');
    parent.addChild(this.groundRoot);
    const metrics = battlefieldGroundGeometry.metrics;
    this.groundGeometry = createSurfaceGeometry(
      metrics.verticesPerEntity,
      metrics.indicesPerEntity,
      GeometryIndexFormat.Uint16,
    );
    this.groundWriter = new TriangleMeshWriter(this.groundGeometry);
    try {
      this.writeGroundPatch(0, 0, true);
      this.groundMesh.initialize(
        this.groundRoot,
        'BattlefieldGround',
        this.groundGeometry,
        this.materials.ground,
        this.groundGeometry.computeBounds(),
        GROUND_SURFACE_OPTIONS,
      );
    } catch (error: unknown) {
      this.dispose();
      throw error;
    }
  }

  /** 按环境 Chunk 步长移动可视地面，使玩家始终位于大地面补丁中央附近。 */
  public updateCenter(playerX: number, playerZ: number): void {
    const nextChunkX = worldCoordinateToEnvironmentChunk(playerX);
    const nextChunkZ = worldCoordinateToEnvironmentChunk(playerZ);
    if (nextChunkX === this.centerChunkX && nextChunkZ === this.centerChunkZ) {
      return;
    }
    this.writeGroundPatch(nextChunkX, nextChunkZ, false);
    this.groundMesh.uploadVertexAttributes(MeshDirty.Pose | MeshDirty.Color);
    this.groundMesh.updateBounds(this.groundGeometry.computeBounds());
    const chunkSize = BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.chunkSize;
    this.groundRoot.setPosition(nextChunkX * chunkSize, 0, nextChunkZ * chunkSize);
    this.centerChunkX = nextChunkX;
    this.centerChunkZ = nextChunkZ;
  }

  /** 重写固定拓扑的世界地面顶点流；运行时不会重建 Mesh 或索引缓冲。 */
  private writeGroundPatch(
    centerChunkX: number,
    centerChunkZ: number,
    writeTopology: boolean,
  ): void {
    const metrics = battlefieldGroundGeometry.metrics;
    this.groundWriter.reset(writeTopology);
    battlefieldGroundGeometry.write(this.groundWriter, centerChunkX, centerChunkZ);
    if (writeTopology) {
      this.groundWriter.commit();
    } else {
      this.groundWriter.assertCounts(metrics.verticesPerEntity, metrics.indicesPerEntity);
    }
    const chunkSize = BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.chunkSize;
    shadeBattlefieldGround(
      this.groundGeometry,
      centerChunkX * chunkSize,
      centerChunkZ * chunkSize,
    );
  }

  /** 先释放战场网格，再释放材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.groundMesh.dispose();
    if (this.groundRoot.isValid) {
      this.groundRoot.destroy();
    }
    this.materials.dispose();
    this.disposed = true;
  }
}
