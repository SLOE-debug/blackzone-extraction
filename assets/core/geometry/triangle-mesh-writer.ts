import { type GeometryIndexArray } from './buffer-geometry';

/**
 * TriangleMeshWriter 所需的最小可写几何契约。
 */
export interface WritableTriangleGeometry {
  readonly maxVertices: number;
  readonly maxIndices: number;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly index: GeometryIndexArray;
  commitCounts(vertexCount: number, indexCount: number): void;
}

/**
 * 按固定顺序写入三角形位置、法线和索引拓扑。
 */
export class TriangleMeshWriter {
  private writeTopology = true;
  private vertexCursor = 0;
  private indexCursor = 0;

  constructor(private readonly geometry: WritableTriangleGeometry) {}

  /** 当前已经写入的顶点数量。 */
  public get vertexCount(): number {
    return this.vertexCursor;
  }

  /** 当前已经写入的索引数量。 */
  public get indexCount(): number {
    return this.indexCursor;
  }

  /**
   * 重置写入游标。
   *
   * @param writeTopology 是否同时重写索引缓冲；动态帧应传入 false。
   */
  public reset(writeTopology: boolean): void {
    this.writeTopology = writeTopology;
    this.vertexCursor = 0;
    this.indexCursor = 0;
  }

  /** 写入一个带单位法线的三维顶点并返回其索引。 */
  public vertex(
    x: number,
    y: number,
    z: number,
    normalX: number,
    normalY: number,
    normalZ: number,
  ): number {
    if (this.vertexCursor >= this.geometry.maxVertices) {
      throw new Error('三角网格写入器超过了顶点容量。');
    }

    const vertexIndex = this.vertexCursor++;
    const offset = vertexIndex * 3;
    this.geometry.positions[offset] = x;
    this.geometry.positions[offset + 1] = y;
    this.geometry.positions[offset + 2] = z;
    this.geometry.normals[offset] = normalX;
    this.geometry.normals[offset + 1] = normalY;
    this.geometry.normals[offset + 2] = normalZ;
    return vertexIndex;
  }

  /** 写入一个三角形索引。 */
  public triangle(a: number, b: number, c: number): void {
    if (this.indexCursor + 3 > this.geometry.maxIndices) {
      throw new Error('三角网格写入器超过了索引容量。');
    }

    if (this.writeTopology) {
      this.geometry.index[this.indexCursor] = a;
      this.geometry.index[this.indexCursor + 1] = b;
      this.geometry.index[this.indexCursor + 2] = c;
    }

    this.indexCursor += 3;
  }

  /** 将当前游标提交为几何有效范围。 */
  public commit(): void {
    this.geometry.commitCounts(this.vertexCursor, this.indexCursor);
  }

  /** 验证动态帧是否保持了初始化时的固定拓扑计数。 */
  public assertCounts(expectedVertices: number, expectedIndices: number): void {
    if (this.vertexCursor !== expectedVertices || this.indexCursor !== expectedIndices) {
      throw new Error(
        `固定拓扑发生变化，预期 ${expectedVertices}/${expectedIndices}，实际 `
        + `${this.vertexCursor}/${this.indexCursor}。`,
      );
    }
  }

  /** 验证一次组合写入相对于起始游标保持了固定拓扑计数。 */
  public assertWrittenCounts(
    startVertex: number,
    startIndex: number,
    expectedVertices: number,
    expectedIndices: number,
  ): void {
    const writtenVertices = this.vertexCursor - startVertex;
    const writtenIndices = this.indexCursor - startIndex;
    if (writtenVertices !== expectedVertices || writtenIndices !== expectedIndices) {
      throw new Error(
        `组合几何拓扑发生变化，预期 ${expectedVertices}/${expectedIndices}，实际 `
        + `${writtenVertices}/${writtenIndices}。`,
      );
    }
  }
}
