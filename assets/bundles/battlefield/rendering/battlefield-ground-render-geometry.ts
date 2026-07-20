import {
  createUnlitColorGeometry,
  GeometryIndexFormat,
  type GeometryIndexArray,
  type UnlitColorBufferGeometry,
} from '../../../core/geometry/buffer-geometry';
import { type WritableTriangleGeometry } from '../../../core/geometry/triangle-mesh-writer';

/**
 * 地面 CPU 求值与 GPU 无光顶点布局之间的窄适配器。
 *
 * 法线只保留在 CPU 侧参与分面色差，不再创建和上传 Standard 光照不需要的 GPU 流。
 */
export class BattlefieldGroundRenderGeometry implements WritableTriangleGeometry {
  public readonly renderGeometry: UnlitColorBufferGeometry;
  public readonly positions: Float32Array;
  public readonly normals: Float32Array;
  public readonly colors: Float32Array;
  public readonly index: GeometryIndexArray;

  constructor(
    public readonly maxVertices: number,
    public readonly maxIndices: number,
  ) {
    this.renderGeometry = createUnlitColorGeometry(
      maxVertices,
      maxIndices,
      GeometryIndexFormat.Uint16,
    );
    this.positions = this.renderGeometry.positions;
    this.normals = new Float32Array(maxVertices * 3);
    this.colors = this.renderGeometry.colors;
    this.index = this.renderGeometry.index;
  }

  /** 当前已经提交给无光渲染几何的有效顶点数。 */
  public get vertexCount(): number {
    return this.renderGeometry.vertexCount;
  }

  /** 同步 TriangleMeshWriter 完成后的固定顶点与索引计数。 */
  public commitCounts(vertexCount: number, indexCount: number): void {
    this.renderGeometry.commitCounts(vertexCount, indexCount);
  }
}
