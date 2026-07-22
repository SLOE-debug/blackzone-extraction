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
  type UnlitColorBufferGeometry,
} from '../geometry/buffer-geometry';
import { MeshDirty } from '../mesh/mesh-dirty';
import { VertexSemantic } from '../mesh/vertex-layout';

enum DynamicMeshBatchState {
  Created,
  Initialized,
  Disposed,
}

const FLOAT_COMPONENT_BYTE_LENGTH = Float32Array.BYTES_PER_ELEMENT;
const POSITION_COMPONENT_COUNT = 3;
const NORMAL_COMPONENT_COUNT = 3;
const COLOR_COMPONENT_COUNT = 4;

/** 动态网格使用的阴影策略。 */
export interface DynamicMeshBatchOptions {
  readonly castShadows: boolean;
  readonly receiveShadows: boolean;
}

/** DynamicMeshBatch 当前支持的精确颜色顶点布局。 */
export type DynamicColorBufferGeometry =
  | SurfaceBufferGeometry
  | UnlitColorBufferGeometry;

/**
 * 管理一个固定索引拓扑及由 VertexLayout 声明的动态 Cocos MeshRenderer。
 */
export class DynamicMeshBatch {
  private state = DynamicMeshBatchState.Created;
  private node: Node | null = null;
  private renderer: MeshRenderer | null = null;
  private mesh: Mesh | null = null;
  private positionBuffer: gfx.Buffer | null = null;
  private normalBuffer: gfx.Buffer | null = null;
  private colorBuffer: gfx.Buffer | null = null;
  private indexBuffer: gfx.Buffer | null = null;
  private positionSource: ArrayBuffer | null = null;
  private normalSource: ArrayBuffer | null = null;
  private colorSource: ArrayBuffer | null = null;
  private indexSource: ArrayBuffer | null = null;
  private indexComponentByteLength = 0;
  private maximumVertexCount = 0;
  private maximumIndexCount = 0;
  private activeIndexCount = 0;
  private readonly minimumPosition = new Vec3();
  private readonly maximumPosition = new Vec3();

  /**
   * 初始化动态网格并上传固定索引拓扑。
   */
  public initialize(
    parent: Node,
    name: string,
    geometry: DynamicColorBufferGeometry,
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
    if (!(indices.buffer instanceof ArrayBuffer)) {
      throw new Error('动态索引流必须由 ArrayBuffer 支持。');
    }
    if (indices.byteOffset !== 0 || indices.byteLength !== indices.buffer.byteLength) {
      throw new Error('动态索引流必须完整覆盖其底层 ArrayBuffer。');
    }
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
    const normals = getNormalView(geometry);
    let normalSource: ArrayBuffer | null = null;
    if (normals !== null) {
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
    const surfaceGeometry = normals === null
      ? commonGeometry
      : { ...commonGeometry, normals };
    const dynamicGeometry = indices instanceof Uint16Array
      ? { ...surfaceGeometry, indices16: indices }
      : { ...surfaceGeometry, indices32: indices };
    const mesh = utils.MeshUtils.createDynamicMesh(0, dynamicGeometry, undefined, {
      maxSubMeshes: 1,
      maxSubMeshVertices: geometry.vertexCount,
      maxSubMeshIndices: geometry.indexCount,
    });
    const renderingSubMesh = mesh.renderingSubMeshes[0];
    const semantics: readonly VertexSemantic[] = geometry.layout.semantics;
    const positionBufferIndex = semantics.indexOf(VertexSemantic.Position);
    const normalBufferIndex = semantics.indexOf(VertexSemantic.Normal);
    const colorBufferIndex = semantics.indexOf(VertexSemantic.Color);
    const vertexBuffer = renderingSubMesh?.vertexBuffers[positionBufferIndex];
    const normalBuffer = normalBufferIndex < 0
      ? undefined
      : renderingSubMesh?.vertexBuffers[normalBufferIndex];
    const colorBuffer = renderingSubMesh?.vertexBuffers[colorBufferIndex];
    const indexBuffer = renderingSubMesh?.indexBuffer;
    if (vertexBuffer === undefined
      || colorBuffer === undefined
      || indexBuffer === undefined
      || indexBuffer === null
      || (normals !== null && normalBuffer === undefined)) {
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
    this.indexBuffer = indexBuffer;
    this.positionSource = positions.buffer;
    this.normalSource = normalSource;
    this.colorSource = colors.buffer;
    this.indexSource = indices.buffer;
    this.indexComponentByteLength = indices.BYTES_PER_ELEMENT;
    this.maximumVertexCount = geometry.vertexCount;
    this.maximumIndexCount = geometry.indexCount;
    this.activeIndexCount = geometry.indexCount;
    this.state = DynamicMeshBatchState.Initialized;
  }

  /**
   * 将实际发生变化的顶点流完整上传到 GPU。
   *
   * @param dirty Evaluator 返回的实际变化位标志；未标记的属性不会提交 GPU 更新。
   * @param activeVertexCount 从各顶点流开头实际需要上传的连续顶点数量。
   * @returns 无返回值；无异常时所有标记且已创建的流均已上传。
   */
  public uploadVertexAttributes(dirty: MeshDirty, activeVertexCount: number): void {
    if (this.state !== DynamicMeshBatchState.Initialized
      || this.positionBuffer === null
      || this.colorBuffer === null
      || this.positionSource === null
      || this.colorSource === null) {
      throw new Error('动态网格批次尚未初始化或已经释放。');
    }
    if (!Number.isInteger(activeVertexCount)
      || activeVertexCount < 0
      || activeVertexCount > this.maximumVertexCount) {
      throw new Error('动态网格活动顶点数必须位于已分配容量内。');
    }
    if (activeVertexCount === 0) {
      return;
    }

    if ((dirty & MeshDirty.Position) !== 0) {
      this.positionBuffer.update(
        this.positionSource,
        activeVertexCount * POSITION_COMPONENT_COUNT * FLOAT_COMPONENT_BYTE_LENGTH,
      );
    }
    if ((dirty & MeshDirty.Normal) !== 0) {
      if (this.normalBuffer === null || this.normalSource === null) {
        throw new Error('当前顶点布局不包含可上传的法线流。');
      }
      this.normalBuffer.update(
        this.normalSource,
        activeVertexCount * NORMAL_COMPONENT_COUNT * FLOAT_COMPONENT_BYTE_LENGTH,
      );
    }
    if ((dirty & MeshDirty.Color) !== 0) {
      this.colorBuffer.update(
        this.colorSource,
        activeVertexCount * COLOR_COMPONENT_COUNT * FLOAT_COMPONENT_BYTE_LENGTH,
      );
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

  /**
   * 限制当前批次实际提交的连续索引范围，不重建已经分配的 GPU 缓冲。
   *
   * 固定容量批次可借此只绘制紧凑区段；容量余量不会再产生顶点或三角形提交。
   */
  public setActiveIndexCount(indexCount: number): void {
    if (this.state !== DynamicMeshBatchState.Initialized
      || this.mesh === null
      || this.renderer === null) {
      throw new Error('动态网格批次尚未初始化或已经释放。');
    }
    if (!Number.isInteger(indexCount)
      || indexCount < 0
      || indexCount > this.maximumIndexCount) {
      throw new Error('动态网格活动索引数必须位于已提交索引容量内。');
    }
    if (indexCount === this.activeIndexCount) {
      return;
    }
    const renderingSubMesh = this.mesh.renderingSubMeshes[0];
    const drawInfo = renderingSubMesh?.drawInfo;
    if (renderingSubMesh === undefined || drawInfo === undefined || drawInfo === null) {
      throw new Error('动态网格缺少可调整的子网格绘制范围。');
    }
    drawInfo.indexCount = indexCount;
    renderingSubMesh.drawInfo = drawInfo;
    const inputAssembler = this.renderer.model?.subModels[0]?.inputAssembler;
    if (inputAssembler !== undefined) {
      inputAssembler.indexCount = indexCount;
    }
    this.activeIndexCount = indexCount;
  }

  /**
   * 从 CPU 索引流开头上传当前紧凑拓扑，并同步实际绘制范围。
   *
   * Cocos 公开 Buffer API 不支持目标偏移，因此调用方必须把活动索引压在前缀区间。
   */
  public uploadIndices(activeIndexCount: number): void {
    if (this.state !== DynamicMeshBatchState.Initialized
      || this.indexBuffer === null
      || this.indexSource === null
      || this.indexComponentByteLength <= 0) {
      throw new Error('动态网格索引缓冲尚未初始化或已经释放。');
    }
    if (!Number.isInteger(activeIndexCount)
      || activeIndexCount < 0
      || activeIndexCount > this.maximumIndexCount) {
      throw new Error('动态网格活动索引数必须位于已分配容量内。');
    }
    if (activeIndexCount > 0) {
      this.indexBuffer.update(
        this.indexSource,
        activeIndexCount * this.indexComponentByteLength,
      );
    }
    this.setActiveIndexCount(activeIndexCount);
  }

  /** 在没有活动实体时停用批次节点，从提交列表中完全移除该 Draw Call。 */
  public setVisible(visible: boolean): void {
    if (this.state !== DynamicMeshBatchState.Initialized || this.node === null) {
      throw new Error('动态网格批次尚未初始化或已经释放。');
    }
    if (this.node.active !== visible) {
      this.node.active = visible;
    }
  }

  /** 释放 Mesh、Renderer 节点和 GPU 缓冲拥有者。 */
  public dispose(): void {
    if (this.state === DynamicMeshBatchState.Disposed) {
      return;
    }

    if (this.renderer?.isValid === true) {
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
    this.indexBuffer = null;
    this.positionSource = null;
    this.normalSource = null;
    this.colorSource = null;
    this.indexSource = null;
    this.indexComponentByteLength = 0;
    this.maximumVertexCount = 0;
    this.maximumIndexCount = 0;
    this.activeIndexCount = 0;
    this.state = DynamicMeshBatchState.Disposed;
  }
}

/** 根据布局声明读取法线流；无光布局不会产生占位缓冲。 */
function getNormalView(geometry: DynamicColorBufferGeometry): Float32Array | null {
  const semantics: readonly VertexSemantic[] = geometry.layout.semantics;
  if (!semantics.includes(VertexSemantic.Normal)) {
    return null;
  }

  const streams = geometry.streams as Partial<Record<VertexSemantic, Float32Array>>;
  const normals = streams[VertexSemantic.Normal];
  if (normals === undefined) {
    throw new Error('顶点布局声明了法线语义，但几何没有对应流。');
  }
  return normals.subarray(0, geometry.vertexCount * 3);
}
