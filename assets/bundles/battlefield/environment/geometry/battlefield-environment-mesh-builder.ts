import { type GeometryBounds } from '../../../../core/geometry/buffer-geometry';
import { type BattlefieldEnvironmentMeshPlan } from './battlefield-environment-mesh-plan';

const NORMAL_EPSILON = 0.000001;
const FACET_VARIANT_COUNT = 7;

/** 初始化阶段使用的三维点。 */
export interface BattlefieldEnvironmentPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 线性空间中的环境顶点色。 */
export interface BattlefieldEnvironmentColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

/**
 * 将领域配方直接展开为独立三角形固定拓扑。
 *
 * 环境模型只在模块初始化阶段编译一次，运行时不再判断面片类型或重算法线。
 */
export class BattlefieldEnvironmentMeshBuilder {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly variants: number[] = [];
  private triangleCount = 0;

  /** 写入一个具有明确绕序的硬分面三角形。 */
  public triangle(
    color: Readonly<BattlefieldEnvironmentColor>,
    a: Readonly<BattlefieldEnvironmentPoint>,
    b: Readonly<BattlefieldEnvironmentPoint>,
    c: Readonly<BattlefieldEnvironmentPoint>,
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
      throw new Error('环境程序几何包含退化三角形。');
    }
    const inverseLength = 1 / length;
    const normalX = crossX * inverseLength;
    const normalY = crossY * inverseLength;
    const normalZ = crossZ * inverseLength;
    const variant = this.triangleCount * 5 % FACET_VARIANT_COUNT;
    this.appendVertex(a, normalX, normalY, normalZ, color, variant);
    this.appendVertex(b, normalX, normalY, normalZ, color, variant);
    this.appendVertex(c, normalX, normalY, normalZ, color, variant);
    this.triangleCount += 1;
  }

  /** 根据期望朝外方向自动修正三角形绕序。 */
  public orientedTriangle(
    color: Readonly<BattlefieldEnvironmentColor>,
    a: Readonly<BattlefieldEnvironmentPoint>,
    b: Readonly<BattlefieldEnvironmentPoint>,
    c: Readonly<BattlefieldEnvironmentPoint>,
    outwardX: number,
    outwardY: number,
    outwardZ: number,
  ): void {
    const dot = triangleOrientation(a, b, c, outwardX, outwardY, outwardZ);
    if (dot >= 0) {
      this.triangle(color, a, b, c);
    } else {
      this.triangle(color, a, c, b);
    }
  }

  /** 将一个四边面按固定对角线展开为两个硬分面三角形。 */
  public quad(
    color: Readonly<BattlefieldEnvironmentColor>,
    a: Readonly<BattlefieldEnvironmentPoint>,
    b: Readonly<BattlefieldEnvironmentPoint>,
    c: Readonly<BattlefieldEnvironmentPoint>,
    d: Readonly<BattlefieldEnvironmentPoint>,
  ): void {
    this.triangle(color, a, b, c);
    this.triangle(color, a, c, d);
  }

  /** 根据期望朝外方向自动修正四边面绕序。 */
  public orientedQuad(
    color: Readonly<BattlefieldEnvironmentColor>,
    a: Readonly<BattlefieldEnvironmentPoint>,
    b: Readonly<BattlefieldEnvironmentPoint>,
    c: Readonly<BattlefieldEnvironmentPoint>,
    d: Readonly<BattlefieldEnvironmentPoint>,
    outwardX: number,
    outwardY: number,
    outwardZ: number,
  ): void {
    const dot = triangleOrientation(a, b, c, outwardX, outwardY, outwardZ);
    if (dot >= 0) {
      this.quad(color, a, b, c, d);
    } else {
      this.quad(color, a, d, c, b);
    }
  }

  /** 写入正反两组面，供巢穴遮蔽壳从任意观察侧保持不透明。 */
  public doubleSidedQuad(
    color: Readonly<BattlefieldEnvironmentColor>,
    a: Readonly<BattlefieldEnvironmentPoint>,
    b: Readonly<BattlefieldEnvironmentPoint>,
    c: Readonly<BattlefieldEnvironmentPoint>,
    d: Readonly<BattlefieldEnvironmentPoint>,
  ): void {
    this.quad(color, a, b, c, d);
    this.quad(color, d, c, b, a);
  }

  /** 冻结连续顶点流、顺序索引和局部包围盒。 */
  public build(): BattlefieldEnvironmentMeshPlan {
    const vertexCount = this.positions.length / 3;
    if (vertexCount <= 0 || vertexCount > 65535) {
      throw new Error('环境单原型顶点数量必须位于 1 到 65535 之间。');
    }
    const indices = new Uint16Array(vertexCount);
    for (let vertex = 0; vertex < vertexCount; vertex++) {
      indices[vertex] = vertex;
    }
    const localPositions = Float32Array.from(this.positions);
    return Object.freeze({
      vertexCount,
      indexCount: indices.length,
      indices,
      localPositions,
      localNormals: Float32Array.from(this.normals),
      localColors: Float32Array.from(this.colors),
      facetVariants: Uint8Array.from(this.variants),
      bounds: computeBounds(localPositions),
    });
  }

  private appendVertex(
    point: Readonly<BattlefieldEnvironmentPoint>,
    normalX: number,
    normalY: number,
    normalZ: number,
    color: Readonly<BattlefieldEnvironmentColor>,
    variant: number,
  ): void {
    this.positions.push(point.x, point.y, point.z);
    this.normals.push(normalX, normalY, normalZ);
    this.colors.push(color.red, color.green, color.blue, color.alpha);
    this.variants.push(variant);
  }
}

function triangleOrientation(
  a: Readonly<BattlefieldEnvironmentPoint>,
  b: Readonly<BattlefieldEnvironmentPoint>,
  c: Readonly<BattlefieldEnvironmentPoint>,
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

function computeBounds(positions: Float32Array): GeometryBounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (let offset = 0; offset < positions.length; offset += 3) {
    const x = positions[offset] ?? 0;
    const y = positions[offset + 1] ?? 0;
    const z = positions[offset + 2] ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  return Object.freeze({ minX, minY, minZ, maxX, maxY, maxZ });
}
