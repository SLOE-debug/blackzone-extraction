import {
  gfx,
  type Material,
  Mesh,
  MeshRenderer,
  Node,
  utils,
  Vec3,
} from 'cc';
import {
  type GeometryBounds,
  type SurfaceBufferGeometry,
} from '../geometry/buffer-geometry';

enum DynamicMeshBatchState {
  Created,
  Initialized,
  Disposed,
}

/**
 * 管理一个固定索引拓扑、动态位置与颜色流的 Cocos MeshRenderer。
 * 法线仅供 CPU 顶点着色使用，不上传给 Unlit 渲染管线。
 */
export class DynamicMeshBatch {
  private state = DynamicMeshBatchState.Created;
  private node: Node | null = null;
  private renderer: MeshRenderer | null = null;
  private mesh: Mesh | null = null;
  private positionBuffer: gfx.Buffer | null = null;
  private colorBuffer: gfx.Buffer | null = null;
  private positionSource: ArrayBuffer | null = null;
  private colorSource: ArrayBuffer | null = null;
  private positionByteLength = 0;
  private colorByteLength = 0;
  private readonly minimumPosition = new Vec3();
  private readonly maximumPosition = new Vec3();

  /**
   * 初始化动态网格并上传固定索引拓扑。
   */
  public initialize(
    parent: Node,
    name: string,
    geometry: SurfaceBufferGeometry,
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
    const colors = geometry.getColorView();
    const indices = geometry.getIndexView();
    if (!(positions.buffer instanceof ArrayBuffer)) {
      throw new Error('动态位置流必须由 ArrayBuffer 支持。');
    }
    if (positions.byteOffset !== 0 || positions.byteLength !== positions.buffer.byteLength) {
      throw new Error('动态位置流必须完整覆盖其底层 ArrayBuffer。');
    }
    if (!(colors.buffer instanceof ArrayBuffer)) {
      throw new Error('动态颜色流必须由 ArrayBuffer 支持。');
    }
    if (colors.byteOffset !== 0 || colors.byteLength !== colors.buffer.byteLength) {
      throw new Error('动态颜色流必须完整覆盖其底层 ArrayBuffer。');
    }

    const commonGeometry = {
      positions,
      colors,
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
    const colorBuffer = renderingSubMesh?.vertexBuffers[1];
    if (vertexBuffer === undefined || colorBuffer === undefined) {
      mesh.destroy();
      throw new Error('动态网格没有可更新的位置或颜色顶点缓冲。');
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
    this.colorBuffer = colorBuffer;
    this.positionSource = positions.buffer;
    this.colorSource = colors.buffer;
    this.positionByteLength = positions.byteLength;
    this.colorByteLength = colors.byteLength;
    this.state = DynamicMeshBatchState.Initialized;
  }

  /** 将完整有效位置流与颜色流上传到 GPU。 */
  public uploadVertexAttributes(): void {
    if (this.state !== DynamicMeshBatchState.Initialized
      || this.positionBuffer === null
      || this.colorBuffer === null
      || this.positionSource === null
      || this.colorSource === null) {
      throw new Error('动态网格批次尚未初始化或已经释放。');
    }

    this.positionBuffer.update(this.positionSource, this.positionByteLength);
    this.colorBuffer.update(this.colorSource, this.colorByteLength);
  }

  /** 刷新动态网格用于视锥裁剪的模型空间包围盒。 */
  public updateBounds(bounds: GeometryBounds): void {
    if (this.state !== DynamicMeshBatchState.Initialized
      || this.mesh === null
      || this.renderer === null) {
      throw new Error('动态网格批次尚未初始化或已经释放。');
    }

    this.minimumPosition.set(bounds.minX, bounds.minY, bounds.minZ);
    this.maximumPosition.set(bounds.maxX, bounds.maxY, bounds.maxZ);
    this.mesh.struct.minPosition = this.minimumPosition;
    this.mesh.struct.maxPosition = this.maximumPosition;
    this.renderer.onGeometryChanged();
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
    this.colorBuffer = null;
    this.positionSource = null;
    this.colorSource = null;
    this.positionByteLength = 0;
    this.colorByteLength = 0;
    this.state = DynamicMeshBatchState.Disposed;
  }
}
