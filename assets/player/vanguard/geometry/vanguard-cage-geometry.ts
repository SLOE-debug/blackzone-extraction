import { type TriangleMeshWriter } from '../../../core/geometry/triangle-mesh-writer';
import { VanguardBone, VANGUARD_BONE_MATRIX_COMPONENTS } from '../model/vanguard-bone';
import { type VanguardState } from '../model/vanguard-state';
import {
  type VanguardCageDefinition,
  type VanguardCagePatch,
  VanguardCagePatchKind,
} from './vanguard-cage';
import { appendVanguardTriangle } from './vanguard-triangle-geometry';

const POINT_COMPONENTS = 3;
const EPSILON = 0.000001;

/** 使用预分配位置缓冲对显式拓扑笼执行双骨骼 CPU 变形。 */
export class VanguardCageGeometryWriter {
  private readonly deformedPositions: Float64Array;

  constructor(private readonly definition: Readonly<VanguardCageDefinition>) {
    this.deformedPositions = new Float64Array(
      definition.vertices.length * POINT_COMPONENTS,
    );
  }

  /** 变形全部共享顶点，并按固定面片顺序写入硬分面三角形。 */
  public append(writer: TriangleMeshWriter, state: VanguardState, entityIndex: number): void {
    this.deformVertices(state, entityIndex);
    for (const patch of this.definition.patches) {
      this.appendPatch(writer, patch);
    }
  }

  /** 把绑定局部坐标经两根当前骨骼矩阵混合到世界空间。 */
  private deformVertices(state: VanguardState, entityIndex: number): void {
    const matrices = state.data.pose.boneMatrices;
    const entityMatrixOffset = entityIndex
      * VanguardBone.Count
      * VANGUARD_BONE_MATRIX_COMPONENTS;
    for (let vertexIndex = 0; vertexIndex < this.definition.vertices.length; vertexIndex++) {
      const spec = this.definition.vertices[vertexIndex];
      if (spec === undefined) {
        throw new Error(`主角拓扑笼顶点不存在：${vertexIndex}`);
      }
      const matrixA = entityMatrixOffset + spec.boneA * VANGUARD_BONE_MATRIX_COMPONENTS;
      const matrixB = entityMatrixOffset + spec.boneB * VANGUARD_BONE_MATRIX_COMPONENTS;
      const ax = transformX(matrices, matrixA, spec.localAX, spec.localAY, spec.localAZ);
      const ay = transformY(matrices, matrixA, spec.localAX, spec.localAY, spec.localAZ);
      const az = transformZ(matrices, matrixA, spec.localAX, spec.localAY, spec.localAZ);
      const weightB = spec.weightB;
      const weightA = 1 - weightB;
      const offset = vertexIndex * POINT_COMPONENTS;
      if (weightB <= 0) {
        this.deformedPositions[offset] = ax;
        this.deformedPositions[offset + 1] = ay;
        this.deformedPositions[offset + 2] = az;
        continue;
      }
      this.deformedPositions[offset] = ax * weightA
        + transformX(matrices, matrixB, spec.localBX, spec.localBY, spec.localBZ) * weightB;
      this.deformedPositions[offset + 1] = ay * weightA
        + transformY(matrices, matrixB, spec.localBX, spec.localBY, spec.localBZ) * weightB;
      this.deformedPositions[offset + 2] = az * weightA
        + transformZ(matrices, matrixB, spec.localBX, spec.localBY, spec.localBZ) * weightB;
    }
  }

  /** 根据面片类型写入一个三角面、普通四边面或中心隆起四边面。 */
  private appendPatch(writer: TriangleMeshWriter, patch: Readonly<VanguardCagePatch>): void {
    switch (patch.kind) {
      case VanguardCagePatchKind.Triangle:
        this.appendPointTriangle(writer, patch.a, patch.b, patch.c);
        return;
      case VanguardCagePatchKind.Quad:
        if (patch.flipDiagonal) {
          this.appendPointTriangle(writer, patch.a, patch.b, patch.d);
          this.appendPointTriangle(writer, patch.b, patch.c, patch.d);
        } else {
          this.appendPointTriangle(writer, patch.a, patch.b, patch.c);
          this.appendPointTriangle(writer, patch.a, patch.c, patch.d);
        }
        return;
      case VanguardCagePatchKind.FacetedQuad:
        this.appendFacetedQuad(writer, patch);
        return;
    }
  }

  /** 使用偏离平均平面的中心点形成四个方向不同的三角切面。 */
  private appendFacetedQuad(
    writer: TriangleMeshWriter,
    patch: Readonly<VanguardCagePatch>,
  ): void {
    const aOffset = patch.a * POINT_COMPONENTS;
    const bOffset = patch.b * POINT_COMPONENTS;
    const cOffset = patch.c * POINT_COMPONENTS;
    const dOffset = patch.d * POINT_COMPONENTS;
    const ax = this.deformedPositions[aOffset] ?? 0;
    const ay = this.deformedPositions[aOffset + 1] ?? 0;
    const az = this.deformedPositions[aOffset + 2] ?? 0;
    const bx = this.deformedPositions[bOffset] ?? 0;
    const by = this.deformedPositions[bOffset + 1] ?? 0;
    const bz = this.deformedPositions[bOffset + 2] ?? 0;
    const cx = this.deformedPositions[cOffset] ?? 0;
    const cy = this.deformedPositions[cOffset + 1] ?? 0;
    const cz = this.deformedPositions[cOffset + 2] ?? 0;
    const dx = this.deformedPositions[dOffset] ?? 0;
    const dy = this.deformedPositions[dOffset + 1] ?? 0;
    const dz = this.deformedPositions[dOffset + 2] ?? 0;
    const edgeABX = bx - ax;
    const edgeABY = by - ay;
    const edgeABZ = bz - az;
    const edgeADX = dx - ax;
    const edgeADY = dy - ay;
    const edgeADZ = dz - az;
    let normalX = edgeABY * edgeADZ - edgeABZ * edgeADY;
    let normalY = edgeABZ * edgeADX - edgeABX * edgeADZ;
    let normalZ = edgeABX * edgeADY - edgeABY * edgeADX;
    const inverseLength = 1 / Math.max(Math.hypot(normalX, normalY, normalZ), EPSILON);
    normalX *= inverseLength;
    normalY *= inverseLength;
    normalZ *= inverseLength;
    const centerX = (ax + bx + cx + dx) * 0.25 + normalX * patch.ridge;
    const centerY = (ay + by + cy + dy) * 0.25 + normalY * patch.ridge;
    const centerZ = (az + bz + cz + dz) * 0.25 + normalZ * patch.ridge;
    appendVanguardTriangle(writer, ax, ay, az, bx, by, bz, centerX, centerY, centerZ);
    appendVanguardTriangle(writer, bx, by, bz, cx, cy, cz, centerX, centerY, centerZ);
    appendVanguardTriangle(writer, cx, cy, cz, dx, dy, dz, centerX, centerY, centerZ);
    appendVanguardTriangle(writer, dx, dy, dz, ax, ay, az, centerX, centerY, centerZ);
  }

  /** 从共享顶点缓冲中读取三个点并写入独立硬分面顶点。 */
  private appendPointTriangle(
    writer: TriangleMeshWriter,
    a: number,
    b: number,
    c: number,
  ): void {
    const aOffset = a * POINT_COMPONENTS;
    const bOffset = b * POINT_COMPONENTS;
    const cOffset = c * POINT_COMPONENTS;
    appendVanguardTriangle(
      writer,
      this.deformedPositions[aOffset] ?? 0,
      this.deformedPositions[aOffset + 1] ?? 0,
      this.deformedPositions[aOffset + 2] ?? 0,
      this.deformedPositions[bOffset] ?? 0,
      this.deformedPositions[bOffset + 1] ?? 0,
      this.deformedPositions[bOffset + 2] ?? 0,
      this.deformedPositions[cOffset] ?? 0,
      this.deformedPositions[cOffset + 1] ?? 0,
      this.deformedPositions[cOffset + 2] ?? 0,
    );
  }
}

function transformX(
  matrices: Float32Array,
  offset: number,
  x: number,
  y: number,
  z: number,
): number {
  return (matrices[offset + 9] ?? 0)
    + (matrices[offset] ?? 0) * x
    + (matrices[offset + 3] ?? 0) * y
    + (matrices[offset + 6] ?? 0) * z;
}

function transformY(
  matrices: Float32Array,
  offset: number,
  x: number,
  y: number,
  z: number,
): number {
  return (matrices[offset + 10] ?? 0)
    + (matrices[offset + 1] ?? 0) * x
    + (matrices[offset + 4] ?? 0) * y
    + (matrices[offset + 7] ?? 0) * z;
}

function transformZ(
  matrices: Float32Array,
  offset: number,
  x: number,
  y: number,
  z: number,
): number {
  return (matrices[offset + 11] ?? 0)
    + (matrices[offset + 2] ?? 0) * x
    + (matrices[offset + 5] ?? 0) * y
    + (matrices[offset + 8] ?? 0) * z;
}
