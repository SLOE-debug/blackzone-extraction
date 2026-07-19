import { StaticSurfaceBufferGeometry } from './buffer-geometry';

const NORMAL_EPSILON = 0.000001;

/** 程序化硬分面几何使用的三维点。 */
export interface FacetedPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 线性空间中的程序化顶点颜色。 */
export interface FacetedColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

/**
 * 把领域配方写成独立顶点的低密度三角面，并自动计算真实 Face Normal。
 *
 * 本类只提供基础拓扑写入能力，不提供 Box、Sphere 等最终造型；不规则轮廓和语义
 * 结构必须由调用方的领域 Geometry 模块明确给出。
 */
export class FacetedMeshBuilder {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];

  /** 写入一个具有明确绕序的硬分面三角形。 */
  public triangle(
    color: Readonly<FacetedColor>,
    a: Readonly<FacetedPoint>,
    b: Readonly<FacetedPoint>,
    c: Readonly<FacetedPoint>,
  ): void {
    const edgeABX = b.x - a.x;
    const edgeABY = b.y - a.y;
    const edgeABZ = b.z - a.z;
    const edgeACX = c.x - a.x;
    const edgeACY = c.y - a.y;
    const edgeACZ = c.z - a.z;
    const crossX = edgeABY * edgeACZ - edgeABZ * edgeACY;
    const crossY = edgeABZ * edgeACX - edgeABX * edgeACZ;
    const crossZ = edgeABX * edgeACY - edgeABY * edgeACX;
    const length = Math.hypot(crossX, crossY, crossZ);
    if (!Number.isFinite(length) || length <= NORMAL_EPSILON) {
      throw new Error('程序化分面几何包含退化三角形。');
    }
    const inverseLength = 1 / length;
    this.appendVertex(a, crossX * inverseLength, crossY * inverseLength, crossZ * inverseLength, color);
    this.appendVertex(b, crossX * inverseLength, crossY * inverseLength, crossZ * inverseLength, color);
    this.appendVertex(c, crossX * inverseLength, crossY * inverseLength, crossZ * inverseLength, color);
  }

  /** 根据期望朝外方向自动修正三角形绕序。 */
  public orientedTriangle(
    color: Readonly<FacetedColor>,
    a: Readonly<FacetedPoint>,
    b: Readonly<FacetedPoint>,
    c: Readonly<FacetedPoint>,
    outwardX: number,
    outwardY: number,
    outwardZ: number,
  ): void {
    if (triangleOrientation(a, b, c, outwardX, outwardY, outwardZ) >= 0) {
      this.triangle(color, a, b, c);
    } else {
      this.triangle(color, a, c, b);
    }
  }

  /** 将领域四边面按一条明确对角线展开为两个硬分面三角形。 */
  public quad(
    color: Readonly<FacetedColor>,
    a: Readonly<FacetedPoint>,
    b: Readonly<FacetedPoint>,
    c: Readonly<FacetedPoint>,
    d: Readonly<FacetedPoint>,
  ): void {
    this.triangle(color, a, b, c);
    this.triangle(color, a, c, d);
  }

  /** 根据期望朝外方向自动修正四边面的整体绕序。 */
  public orientedQuad(
    color: Readonly<FacetedColor>,
    a: Readonly<FacetedPoint>,
    b: Readonly<FacetedPoint>,
    c: Readonly<FacetedPoint>,
    d: Readonly<FacetedPoint>,
    outwardX: number,
    outwardY: number,
    outwardZ: number,
  ): void {
    if (triangleOrientation(a, b, c, outwardX, outwardY, outwardZ) >= 0) {
      this.quad(color, a, b, c, d);
    } else {
      this.quad(color, a, d, c, b);
    }
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
    point: Readonly<FacetedPoint>,
    normalX: number,
    normalY: number,
    normalZ: number,
    color: Readonly<FacetedColor>,
  ): void {
    this.positions.push(point.x, point.y, point.z);
    this.normals.push(normalX, normalY, normalZ);
    this.colors.push(color.red, color.green, color.blue, color.alpha);
  }
}

function triangleOrientation(
  a: Readonly<FacetedPoint>,
  b: Readonly<FacetedPoint>,
  c: Readonly<FacetedPoint>,
  outwardX: number,
  outwardY: number,
  outwardZ: number,
): number {
  const edgeABX = b.x - a.x;
  const edgeABY = b.y - a.y;
  const edgeABZ = b.z - a.z;
  const edgeACX = c.x - a.x;
  const edgeACY = c.y - a.y;
  const edgeACZ = c.z - a.z;
  const normalX = edgeABY * edgeACZ - edgeABZ * edgeACY;
  const normalY = edgeABZ * edgeACX - edgeABX * edgeACZ;
  const normalZ = edgeABX * edgeACY - edgeABY * edgeACX;
  return normalX * outwardX + normalY * outwardY + normalZ * outwardZ;
}
