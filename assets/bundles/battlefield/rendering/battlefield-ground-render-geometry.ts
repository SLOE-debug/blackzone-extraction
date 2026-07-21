import {
  createUnlitColorGeometry,
  GeometryIndexFormat,
  type GeometryIndexArray,
  type UnlitColorBufferGeometry,
} from '../../../core/geometry/buffer-geometry';
import { type WritableTriangleGeometry } from '../../../core/geometry/triangle-mesh-writer';

/**
 * 地面 CPU 求值与 GPU Unlit 顶点布局之间的窄适配器。
 *
 * TriangleMeshWriter 直接写入最终 Position 与固定索引；分面明暗由顶点色承担。
 */
export class BattlefieldGroundRenderGeometry implements WritableTriangleGeometry {
  public readonly renderGeometry: UnlitColorBufferGeometry;
  public readonly positions: Float32Array;
  /** 仅供 CPU 分面着色读取，不会创建或上传 GPU Normal 流。 */
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

  /** 当前已经提交给 Unlit 渲染几何的有效顶点数。 */
  public get vertexCount(): number {
    return this.renderGeometry.vertexCount;
  }

  /** 同步 TriangleMeshWriter 完成后的固定顶点与索引计数。 */
  public commitCounts(vertexCount: number, indexCount: number): void {
    this.renderGeometry.commitCounts(vertexCount, indexCount);
  }
}
