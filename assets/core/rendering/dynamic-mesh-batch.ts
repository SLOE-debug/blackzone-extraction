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
import { MeshDirty } from '../mesh/mesh-dirty';

enum DynamicMeshBatchState {
  Created,
  Initialized,
  Disposed,
}

/** 动态网格使用的顶点流和阴影策略。 */
export interface DynamicMeshBatchOptions {
  readonly uploadLightingAttributes: boolean;
  readonly castShadows: boolean;
  readonly receiveShadows: boolean;
}

/**
 * 管理一个固定索引拓扑、动态位置、可选法线与颜色流的 Cocos MeshRenderer。
 */
export class DynamicMeshBatch {
  private state = DynamicMeshBatchState.Created;
  private node: Node | null = null;
  private renderer: MeshRenderer | null = null;
  private mesh: Mesh | null = null;
  private positionBuffer: gfx.Buffer | null = null;
  private normalBuffer: gfx.Buffer | null = null;
  private colorBuffer: gfx.Buffer | null = null;
  private positionSource: ArrayBuffer | null = null;
  private normalSource: ArrayBuffer | null = null;
  private colorSource: ArrayBuffer | null = null;
  private positionByteLength = 0;
  private normalByteLength = 0;
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
    options: Readonly<DynamicMeshBatchOptions>,
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
    const normals = geometry.getNormalView();
    let normalSource: ArrayBuffer | null = null;
    if (options.uploadLightingAttributes) {
      if (!(normals.buffer instanceof ArrayBuffer)) {
        throw new Error('动态法线流必须由 ArrayBuffer 支持。');
      }
      if (normals.byteOffset !== 0 || normals.byteLength !== normals.buffer.byteLength) {
        throw new Error('动态法线流必须完整覆盖其底层 ArrayBuffer。');
      }
      normalSource = normals.buffer;
    }

    const commonGeometry = {
      positions,
      colors,
      minPos: { x: bounds.minX, y: bounds.minY, z: bounds.minZ },
      maxPos: { x: bounds.maxX, y: bounds.maxY, z: bounds.maxZ },
    };
    const surfaceGeometry = options.uploadLightingAttributes
      ? { ...commonGeometry, normals }
      : commonGeometry;
    const dynamicGeometry = indices instanceof Uint16Array
      ? { ...surfaceGeometry, indices16: indices }
      : { ...surfaceGeometry, indices32: indices };
    const mesh = utils.MeshUtils.createDynamicMesh(0, dynamicGeometry, undefined, {
      maxSubMeshes: 1,
      maxSubMeshVertices: geometry.vertexCount,
      maxSubMeshIndices: geometry.indexCount,
    });
    const renderingSubMesh = mesh.renderingSubMeshes[0];
    const vertexBuffer = renderingSubMesh?.vertexBuffers[0];
    const normalBuffer = options.uploadLightingAttributes
      ? renderingSubMesh?.vertexBuffers[1]
      : undefined;
    const colorBuffer = renderingSubMesh?.vertexBuffers[
      options.uploadLightingAttributes ? 2 : 1
    ];
    if (vertexBuffer === undefined
      || colorBuffer === undefined
      || (options.uploadLightingAttributes && normalBuffer === undefined)) {
      mesh.destroy();
      throw new Error('动态网格没有可更新的位置、法线或颜色顶点缓冲。');
    }

    const node = new Node(name);
    parent.addChild(node);
    const renderer = node.addComponent(MeshRenderer);
    renderer.mesh = mesh;
    renderer.setMaterial(material, 0);
    renderer.shadowCastingMode = options.castShadows
      ? MeshRenderer.ShadowCastingMode.ON
      : MeshRenderer.ShadowCastingMode.OFF;
    renderer.receiveShadow = options.receiveShadows
      ? MeshRenderer.ShadowReceivingMode.ON
      : MeshRenderer.ShadowReceivingMode.OFF;
    renderer.onGeometryChanged();

    this.node = node;
    this.renderer = renderer;
    this.mesh = mesh;
    this.positionBuffer = vertexBuffer;
    this.normalBuffer = normalBuffer ?? null;
    this.colorBuffer = colorBuffer;
    this.positionSource = positions.buffer;
    this.normalSource = normalSource;
    this.colorSource = colors.buffer;
    this.positionByteLength = positions.byteLength;
    this.normalByteLength = options.uploadLightingAttributes ? normals.byteLength : 0;
    this.colorByteLength = colors.byteLength;
    this.state = DynamicMeshBatchState.Initialized;
  }

  /**
   * 将实际发生变化的顶点流完整上传到 GPU。
   *
   * @param dirty Evaluator 返回的实际变化位标志；未标记的属性不会提交 GPU 更新。
   * @returns 无返回值；无异常时所有标记且已创建的流均已上传。
   */
  public uploadVertexAttributes(dirty: MeshDirty): void {
    if (this.state !== DynamicMeshBatchState.Initialized
      || this.positionBuffer === null
      || this.colorBuffer === null
      || this.positionSource === null
      || this.colorSource === null) {
      throw new Error('动态网格批次尚未初始化或已经释放。');
    }

    if ((dirty & MeshDirty.Position) !== 0) {
      this.positionBuffer.update(this.positionSource, this.positionByteLength);
    }
    if ((dirty & MeshDirty.Normal) !== 0
      && this.normalBuffer !== null
      && this.normalSource !== null) {
      this.normalBuffer.update(this.normalSource, this.normalByteLength);
    }
    if ((dirty & MeshDirty.Color) !== 0) {
      this.colorBuffer.update(this.colorSource, this.colorByteLength);
    }
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
    this.normalBuffer = null;
    this.colorBuffer = null;
    this.positionSource = null;
    this.normalSource = null;
    this.colorSource = null;
    this.positionByteLength = 0;
    this.normalByteLength = 0;
    this.colorByteLength = 0;
    this.state = DynamicMeshBatchState.Disposed;
  }
}
