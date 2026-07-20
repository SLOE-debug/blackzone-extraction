import { StaticSurfaceBufferGeometry } from '../buffer-geometry';
import { type FacetedTriangleSink } from './faceted-emitter';

/** 线性空间中的程序化顶点颜色。 */
export interface FacetedColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

/**
 * 收集独立分面顶点并冻结为静态表面 Geometry。
 *
 * 本类只保存 Emitter 已经解析好的流，不负责点生成、拓扑、绕序或法线计算。
 */
export class StaticFacetedMeshSink implements FacetedTriangleSink<Readonly<FacetedColor>> {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];

  /** 追加一个已经完成绕序和单位法线计算的三角形。 */
  public appendFlatTriangle(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
    normalX: number,
    normalY: number,
    normalZ: number,
    color: Readonly<FacetedColor>,
  ): void {
    this.appendVertex(ax, ay, az, normalX, normalY, normalZ, color);
    this.appendVertex(bx, by, bz, normalX, normalY, normalZ, color);
    this.appendVertex(cx, cy, cz, normalX, normalY, normalZ, color);
  }

  /** 冻结为包含 Position、Normal、Color、UV 和顺序索引的静态表面几何。 */
  public build(): StaticSurfaceBufferGeometry<Uint16Array> {
    const vertexCount = this.positions.length / 3;
    if (vertexCount <= 0 || vertexCount > 65535) {
      throw new Error('分面静态几何顶点数量必须位于 1 到 65535 之间。');
    }
    const indices = new Uint16Array(vertexCount);
    for (let vertex = 0; vertex < vertexCount; vertex++) {
      indices[vertex] = vertex;
    }
    const geometry = new StaticSurfaceBufferGeometry(vertexCount, vertexCount, indices);
    geometry.positions.set(this.positions);
    geometry.normals.set(this.normals);
    geometry.colors.set(this.colors);
    geometry.uvs.fill(0);
    geometry.commitCounts(vertexCount, vertexCount);
    return geometry;
  }

  private appendVertex(
    x: number,
    y: number,
    z: number,
    normalX: number,
    normalY: number,
    normalZ: number,
    color: Readonly<FacetedColor>,
  ): void {
    this.positions.push(x, y, z);
    this.normals.push(normalX, normalY, normalZ);
    this.colors.push(color.red, color.green, color.blue, color.alpha);
  }
}
