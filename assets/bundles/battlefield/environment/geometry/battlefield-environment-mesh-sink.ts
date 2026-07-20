import { type GeometryBounds } from '../../../../core/geometry/buffer-geometry';
import { type FacetedTriangleSink } from '../../../../core/geometry/faceted/faceted-emitter';
import { type BattlefieldEnvironmentMeshPlan } from './battlefield-environment-mesh-plan';

const FACET_VARIANT_COUNT = 7;

/** 线性空间中的环境顶点色。 */
export interface BattlefieldEnvironmentColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

/**
 * 收集环境原型的独立分面流并编译为固定局部 MeshPlan。
 *
 * 本类只保存 Emitter 已经解析的位置、法线和颜色，不负责拓扑或绕序。
 */
export class BattlefieldEnvironmentMeshSink
implements FacetedTriangleSink<Readonly<BattlefieldEnvironmentColor>> {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly variants: number[] = [];
  private triangleCount = 0;

  /** 追加一个已经完成绕序和单位法线计算的环境三角形。 */
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
    color: Readonly<BattlefieldEnvironmentColor>,
  ): void {
    const variant = this.triangleCount * 5 % FACET_VARIANT_COUNT;
    this.appendVertex(ax, ay, az, normalX, normalY, normalZ, color, variant);
    this.appendVertex(bx, by, bz, normalX, normalY, normalZ, color, variant);
    this.appendVertex(cx, cy, cz, normalX, normalY, normalZ, color, variant);
    this.triangleCount += 1;
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
    x: number,
    y: number,
    z: number,
    normalX: number,
    normalY: number,
    normalZ: number,
    color: Readonly<BattlefieldEnvironmentColor>,
    variant: number,
  ): void {
    this.positions.push(x, y, z);
    this.normals.push(normalX, normalY, normalZ);
    this.colors.push(color.red, color.green, color.blue, color.alpha);
    this.variants.push(variant);
  }
}

/** 从完整局部位置流计算环境原型包围盒。 */
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
