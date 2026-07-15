import {
  gfx,
  type Material,
  Mesh,
  MeshRenderer,
  Node,
  utils,
} from 'cc';
import { type GeometryBounds, type PositionBufferGeometry } from '../geometry/buffer-geometry';

enum DynamicMeshBatchState {
  Created,
  Initialized,
  Disposed,
}

/**
 * 管理一个固定索引拓扑、动态位置流的 Cocos MeshRenderer。
 */
export class DynamicMeshBatch {
  private state = DynamicMeshBatchState.Created;
  private node: Node | null = null;
  private renderer: MeshRenderer | null = null;
  private mesh: Mesh | null = null;
  private positionBuffer: gfx.Buffer | null = null;
  private positionSource: ArrayBuffer | null = null;
  private positionByteLength = 0;

  /**
   * 初始化动态网格并上传固定索引拓扑。
   */
  public initialize(
    parent: Node,
    name: string,
    geometry: PositionBufferGeometry,
    material: Material,
    bounds: GeometryBounds,
  ): void {
    if (this.state !== DynamicMeshBatchState.Created) {
      throw new Error('动态网格批次只能初始化一次。');
    }
    if (geometry.vertexCount <= 0 || geometry.indexCount <= 0) {
      throw new Error('动态网格批次要求已经提交的非空几何。');
    }

    const positions = geometry.getPositionView();
    const indices = geometry.getIndexView();
    if (!(positions.buffer instanceof ArrayBuffer)) {
      throw new Error('动态位置流必须由 ArrayBuffer 支持。');
    }
    if (positions.byteOffset !== 0 || positions.byteLength !== positions.buffer.byteLength) {
      throw new Error('动态位置流必须完整覆盖其底层 ArrayBuffer。');
    }

    const commonGeometry = {
      positions,
      minPos: { x: bounds.minX, y: bounds.minY, z: bounds.minZ },
      maxPos: { x: bounds.maxX, y: bounds.maxY, z: bounds.maxZ },
    };
    const dynamicGeometry = indices instanceof Uint16Array
      ? { ...commonGeometry, indices16: indices }
      : { ...commonGeometry, indices32: indices };
    const mesh = utils.MeshUtils.createDynamicMesh(0, dynamicGeometry, undefined, {
      maxSubMeshes: 1,
      maxSubMeshVertices: geometry.vertexCount,
      maxSubMeshIndices: geometry.indexCount,
    });
    const renderingSubMesh = mesh.renderingSubMeshes[0];
    const vertexBuffer = renderingSubMesh?.vertexBuffers[0];
    if (vertexBuffer === undefined) {
      mesh.destroy();
      throw new Error('动态网格没有可更新的位置顶点缓冲。');
    }

    const node = new Node(name);
    parent.addChild(node);
    const renderer = node.addComponent(MeshRenderer);
    renderer.mesh = mesh;
    renderer.setMaterial(material, 0);
    renderer.onGeometryChanged();

    this.node = node;
    this.renderer = renderer;
    this.mesh = mesh;
    this.positionBuffer = vertexBuffer;
    this.positionSource = positions.buffer;
    this.positionByteLength = positions.byteLength;
    this.state = DynamicMeshBatchState.Initialized;
  }

  /** 将完整有效位置流上传到 GPU。 */
  public uploadPositions(): void {
    if (this.state !== DynamicMeshBatchState.Initialized
      || this.positionBuffer === null
      || this.positionSource === null) {
      throw new Error('动态网格批次尚未初始化或已经释放。');
    }

    this.positionBuffer.update(this.positionSource, this.positionByteLength);
  }

  /** 释放 Mesh、Renderer 节点和 GPU 缓冲拥有者。 */
  public dispose(): void {
    if (this.state === DynamicMeshBatchState.Disposed) {
      return;
    }

    if (this.renderer !== null) {
      this.renderer.mesh = null;
    }
    this.mesh?.destroy();
    if (this.node?.isValid === true) {
      this.node.destroy();
    }

    this.node = null;
    this.renderer = null;
    this.mesh = null;
    this.positionBuffer = null;
    this.positionSource = null;
    this.positionByteLength = 0;
    this.state = DynamicMeshBatchState.Disposed;
  }
}
