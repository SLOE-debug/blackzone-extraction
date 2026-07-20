import { Node } from 'cc';
import { TriangleMeshWriter } from '../../../core/geometry/triangle-mesh-writer';
import { MeshDirty } from '../../../core/mesh/mesh-dirty';
import {
  DynamicMeshBatch,
  type DynamicMeshBatchOptions,
} from '../../../core/rendering/dynamic-mesh-batch';
import {
  battlefieldGroundGeometry,
  type MutableBattlefieldGroundWriteRange,
} from '../geometry/battlefield-ground-geometry';
import { BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG } from '../environment/model/battlefield-environment-config';
import { worldCoordinateToEnvironmentChunk } from '../environment/model/battlefield-environment-chunk';
import { BATTLEFIELD_LAYOUT } from '../model/battlefield-layout';
import { BattlefieldGroundRenderGeometry } from './battlefield-ground-render-geometry';
import { BattlefieldMaterials } from './battlefield-materials';
import {
  shadeBattlefieldGround,
  shadeBattlefieldGroundRange,
} from './battlefield-vertex-shading';

const GROUND_SURFACE_OPTIONS: DynamicMeshBatchOptions = Object.freeze({
  castShadows: false,
  receiveShadows: false,
});

/** 每帧只重算八行地面单元，把原来的 20,000 三角形长任务摊到十三帧。 */
const GROUND_UPDATE_ROW_BUDGET = 8;

/** 地面局部轮廓只会在固定半径外增加不足一米的确定性扰动。 */
const GROUND_BOUNDS = Object.freeze({
  minX: -BATTLEFIELD_LAYOUT.groundHalfExtent - 1,
  minY: -0.1,
  minZ: -BATTLEFIELD_LAYOUT.groundHalfExtent - 1,
  maxX: BATTLEFIELD_LAYOUT.groundHalfExtent + 1,
  maxY: 0.1,
  maxZ: BATTLEFIELD_LAYOUT.groundHalfExtent + 1,
});

/** 创建战场程序化岩地并管理分帧 Chunk 同步与对应 GPU 资源。 */
export class BattlefieldRenderer {
  private readonly materials: BattlefieldMaterials;
  private readonly groundGeometry: BattlefieldGroundRenderGeometry;
  private readonly groundWriter: TriangleMeshWriter;
  private readonly groundMesh = new DynamicMeshBatch();
  private readonly groundRoot: Node;
  private readonly writeRange: MutableBattlefieldGroundWriteRange = {
    firstVertex: 0,
    vertexCount: 0,
    centerWorldX: 0,
    centerWorldZ: 0,
  };
  private centerChunkX = 0;
  private centerChunkZ = 0;
  private pendingChunkX = 0;
  private pendingChunkZ = 0;
  private synchronizationActive = false;
  private uploadPending = false;
  private disposed = false;

  constructor(parent: Node) {
    this.materials = new BattlefieldMaterials();
    this.groundRoot = new Node('BattlefieldGroundRoot');
    parent.addChild(this.groundRoot);
    const metrics = battlefieldGroundGeometry.metrics;
    this.groundGeometry = new BattlefieldGroundRenderGeometry(
      metrics.verticesPerEntity,
      metrics.indicesPerEntity,
    );
    this.groundWriter = new TriangleMeshWriter(this.groundGeometry);
    try {
      battlefieldGroundGeometry.write(this.groundWriter, 0, 0);
      shadeBattlefieldGround(this.groundGeometry, 0, 0);
      this.groundMesh.initialize(
        this.groundRoot,
        'BattlefieldGround',
        this.groundGeometry.renderGeometry,
        this.materials.ground,
        GROUND_BOUNDS,
        GROUND_SURFACE_OPTIONS,
      );
    } catch (error: unknown) {
      this.dispose();
      throw error;
    }
  }

  /** 请求玩家所在 Chunk，并在固定行预算内推进尚未完成的 CPU 地面求值。 */
  public updateCenter(playerX: number, playerZ: number): void {
    const nextChunkX = worldCoordinateToEnvironmentChunk(playerX);
    const nextChunkZ = worldCoordinateToEnvironmentChunk(playerZ);
    if (nextChunkX !== this.pendingChunkX || nextChunkZ !== this.pendingChunkZ) {
      this.requestCenter(nextChunkX, nextChunkZ);
    }
    this.updateSynchronization();
  }

  /** 重启目标补丁写入；返回当前已显示 Chunk 时直接放弃未上传工作。 */
  private requestCenter(nextChunkX: number, nextChunkZ: number): void {
    this.pendingChunkX = nextChunkX;
    this.pendingChunkZ = nextChunkZ;
    this.uploadPending = false;
    if (nextChunkX === this.centerChunkX && nextChunkZ === this.centerChunkZ) {
      battlefieldGroundGeometry.cancelWrite();
      this.synchronizationActive = false;
      return;
    }
    battlefieldGroundGeometry.beginWrite(
      this.groundWriter,
      nextChunkX,
      nextChunkZ,
      false,
    );
    this.synchronizationActive = true;
  }

  /** 推进一份 CPU 行任务；全部完成后的下一帧再执行唯一一次完整 GPU 上传。 */
  private updateSynchronization(): void {
    if (this.synchronizationActive) {
      const complete = battlefieldGroundGeometry.writeNextRows(
        this.groundWriter,
        GROUND_UPDATE_ROW_BUDGET,
        this.writeRange,
      );
      shadeBattlefieldGroundRange(
        this.groundGeometry,
        this.writeRange.firstVertex,
        this.writeRange.vertexCount,
        this.writeRange.centerWorldX,
        this.writeRange.centerWorldZ,
      );
      if (complete) {
        this.synchronizationActive = false;
        this.uploadPending = true;
      }
      return;
    }
    if (!this.uploadPending) {
      return;
    }
    this.groundMesh.uploadVertexAttributes(MeshDirty.Position | MeshDirty.Color);
    const chunkSize = BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.chunkSize;
    this.groundRoot.setPosition(
      this.pendingChunkX * chunkSize,
      0,
      this.pendingChunkZ * chunkSize,
    );
    this.centerChunkX = this.pendingChunkX;
    this.centerChunkZ = this.pendingChunkZ;
    this.uploadPending = false;
  }

  /** 先释放战场网格，再释放材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    battlefieldGroundGeometry.cancelWrite();
    this.groundMesh.dispose();
    if (this.groundRoot.isValid) {
      this.groundRoot.destroy();
    }
    this.materials.dispose();
    this.disposed = true;
  }
}
