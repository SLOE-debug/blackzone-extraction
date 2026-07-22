import {
  gfx,
  type Material,
  Mesh,
  MeshRenderer,
  Node,
  utils,
} from 'cc';
import { type GeometryBounds } from '../../../../../../core/geometry/buffer-geometry';
import { type CurveCrawlerGpuGeometry } from '../../geometry/curve-crawler-gpu-geometry';
import { CurveCrawlerGpuVertexAttribute } from './curve-crawler-gpu-vertex-layout';

enum CurveCrawlerGpuBatchState {
  Created,
  Initialized,
  Disposed,
}

/** 创建静态 Bind Pose 顶点流，并只允许活动索引前缀在运行时变化。 */
export class CurveCrawlerGpuMeshBatch {
  private state = CurveCrawlerGpuBatchState.Created;
  private node: Node | null = null;
  private renderer: MeshRenderer | null = null;
  private mesh: Mesh | null = null;
  private indexBuffer: gfx.Buffer | null = null;
  private indexSource: Uint32Array | null = null;
  private maximumIndexCount = 0;
  private activeIndexCount = 0;

  public initialize(
    parent: Node,
    geometry: CurveCrawlerGpuGeometry,
    material: Material,
    bounds: GeometryBounds,
    activeIndexCount: number,
  ): void {
    if (this.state !== CurveCrawlerGpuBatchState.Created) {
      throw new Error('Curve Crawler GPU 批次只能初始化一次。');
    }
    assertActiveIndexCount(activeIndexCount, geometry.indexCapacity);
    const dynamicGeometry = {
      positions: geometry.positions,
      normals: geometry.normals,
      uvs: geometry.slotAndSemantic,
      colors: geometry.colors,
      customAttributes: [
        {
          attr: new gfx.Attribute(
            CurveCrawlerGpuVertexAttribute.Deformation,
            gfx.Format.RGBA32F,
          ),
          values: geometry.deformation,
        },
        {
          attr: new gfx.Attribute(
            CurveCrawlerGpuVertexAttribute.DeformationPivot,
            gfx.Format.RGBA32F,
          ),
          values: geometry.pivot,
        },
      ],
      indices32: geometry.index,
      minPos: { x: bounds.minX, y: bounds.minY, z: bounds.minZ },
      maxPos: { x: bounds.maxX, y: bounds.maxY, z: bounds.maxZ },
    };
    const mesh = utils.MeshUtils.createDynamicMesh(0, dynamicGeometry, undefined, {
      maxSubMeshes: 1,
      maxSubMeshVertices: geometry.vertexCount,
      maxSubMeshIndices: geometry.indexCapacity,
    });
    const renderingSubMesh = mesh.renderingSubMeshes[0];
    const indexBuffer = renderingSubMesh?.indexBuffer;
    if (renderingSubMesh === undefined
      || indexBuffer === undefined
      || indexBuffer === null) {
      mesh.destroy();
      throw new Error('Curve Crawler GPU 网格没有有效索引缓冲。');
    }

    const node = new Node('CurveCrawlerGpuBatch');
    parent.addChild(node);
    const renderer = node.addComponent(MeshRenderer);
    renderer.mesh = mesh;
    renderer.setMaterial(material, 0);
    renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
    renderer.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF;
    renderer.onGeometryChanged();

    this.node = node;
    this.renderer = renderer;
    this.mesh = mesh;
    this.indexBuffer = indexBuffer;
    this.indexSource = geometry.index;
    this.maximumIndexCount = geometry.indexCapacity;
    this.activeIndexCount = geometry.indexCapacity;
    this.state = CurveCrawlerGpuBatchState.Initialized;
    this.setActiveIndexCount(activeIndexCount);
    this.setVisible(activeIndexCount > 0);
  }

  /** 从 CPU 索引流开头整体更新当前活动前缀。 */
  public uploadIndices(activeIndexCount: number): void {
    this.ensureInitialized();
    assertActiveIndexCount(activeIndexCount, this.maximumIndexCount);
    if (activeIndexCount > 0) {
      const indexBuffer = this.indexBuffer;
      const indexSource = this.indexSource;
      if (indexBuffer === null || indexSource === null) {
        throw new Error('Curve Crawler GPU 批次缺少索引资源。');
      }
      const source = indexSource.subarray(0, activeIndexCount);
      indexBuffer.update(source, source.byteLength);
    }
    this.setActiveIndexCount(activeIndexCount);
  }

  /** 精确限制 DrawInfo 与 InputAssembler 的索引提交数量。 */
  public setActiveIndexCount(indexCount: number): void {
    this.ensureInitialized();
    assertActiveIndexCount(indexCount, this.maximumIndexCount);
    if (indexCount === this.activeIndexCount) {
      return;
    }
    const renderingSubMesh = this.mesh?.renderingSubMeshes[0];
    const drawInfo = renderingSubMesh?.drawInfo;
    if (renderingSubMesh === undefined || drawInfo === undefined || drawInfo === null) {
      throw new Error('Curve Crawler GPU 批次缺少可调整的绘制范围。');
    }
    drawInfo.indexCount = indexCount;
    renderingSubMesh.drawInfo = drawInfo;
    const inputAssembler = this.renderer?.model?.subModels[0]?.inputAssembler;
    if (inputAssembler !== undefined) {
      inputAssembler.indexCount = indexCount;
    }
    this.activeIndexCount = indexCount;
  }

  public setVisible(visible: boolean): void {
    this.ensureInitialized();
    if (this.node !== null && this.node.active !== visible) {
      this.node.active = visible;
    }
  }

  public dispose(): void {
    if (this.state === CurveCrawlerGpuBatchState.Disposed) {
      return;
    }
    this.state = CurveCrawlerGpuBatchState.Disposed;
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
    this.indexBuffer = null;
    this.indexSource = null;
    this.maximumIndexCount = 0;
    this.activeIndexCount = 0;
  }

  private ensureInitialized(): void {
    if (this.state !== CurveCrawlerGpuBatchState.Initialized) {
      throw new Error('Curve Crawler GPU 批次尚未初始化或已经释放。');
    }
  }
}

function assertActiveIndexCount(indexCount: number, capacity: number): void {
  if (!Number.isInteger(indexCount) || indexCount < 0 || indexCount > capacity) {
    throw new Error('Curve Crawler GPU 活动索引数量超出固定容量。');
  }
}
