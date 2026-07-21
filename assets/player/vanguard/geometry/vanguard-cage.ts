import { createVanguardBindPoseMatrices } from '../animation/vanguard-pose';
import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
} from '../model/vanguard-bone';
import { resolveVanguardDepth } from '../model/vanguard-depth-profile';

const BIND_POSE_MATRICES = createVanguardBindPoseMatrices();
const FACETED_QUAD_MINIMUM_RIDGE = 0.01;

/** 显式人形拓扑笼支持的面片类型。 */
export enum VanguardCagePatchKind {
  Triangle,
  Quad,
  FacetedQuad,
}

/** 一个最多受两根骨骼影响的绑定姿态顶点。 */
export interface VanguardCageVertexSpec {
  readonly boneA: VanguardBone;
  readonly localAX: number;
  readonly localAY: number;
  readonly localAZ: number;
  readonly boneB: VanguardBone;
  readonly localBX: number;
  readonly localBY: number;
  readonly localBZ: number;
  readonly weightB: number;
}

/** 一个显式三角面或四边面片。 */
export interface VanguardCagePatch {
  readonly kind: VanguardCagePatchKind;
  readonly surface: number;
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly ridge: number;
  readonly flipDiagonal: boolean;
}

/** 完整固定拓扑笼及其按表面连续排列的三角形数量。 */
export interface VanguardCageDefinition {
  readonly vertices: readonly VanguardCageVertexSpec[];
  readonly patches: readonly VanguardCagePatch[];
  readonly surfaceTriangleCounts: readonly number[];
  readonly triangleCount: number;
}

/** 在初始化阶段构造具有语义顶点和显式面片的程序化拓扑笼。 */
export class VanguardCageBuilder {
  private readonly vertices: VanguardCageVertexSpec[] = [];
  private readonly bindPositions: number[] = [];
  private readonly patchesBySurface: VanguardCagePatch[][];

  constructor(private readonly surfaceCount: number) {
    if (!Number.isInteger(surfaceCount) || surfaceCount <= 0) {
      throw new Error('主角拓扑笼表面数量必须是正整数。');
    }
    this.patchesBySurface = Array.from({ length: surfaceCount }, () => []);
  }

  /** 添加一个美术基准绑定姿态顶点，应用纵深轮廓后预计算骨骼局部坐标。 */
  public vertex(
    x: number,
    y: number,
    z: number,
    boneA: VanguardBone,
    boneB: VanguardBone = boneA,
    weightB = 0,
  ): number {
    return this.addResolvedVertex(
      x,
      y,
      resolveVanguardDepth(y, z),
      boneA,
      boneB,
      weightB,
    );
  }

  /** 添加一个已经应用角色纵深轮廓的绑定姿态顶点。 */
  public resolvedVertex(
    x: number,
    y: number,
    z: number,
    boneA: VanguardBone,
    boneB: VanguardBone = boneA,
    weightB = 0,
  ): number {
    return this.addResolvedVertex(x, y, z, boneA, boneB, weightB);
  }

  private addResolvedVertex(
    x: number,
    y: number,
    z: number,
    boneA: VanguardBone,
    boneB: VanguardBone,
    weightB: number,
  ): number {
    if (!Number.isFinite(weightB) || weightB < 0 || weightB > 1) {
      throw new Error('主角顶点第二骨骼权重必须位于零到一之间。');
    }
    const localA = worldToBoneLocal(x, y, z, boneA);
    const localB = worldToBoneLocal(x, y, z, boneB);
    const index = this.vertices.length;
    this.vertices.push(Object.freeze({
      boneA,
      localAX: localA.x,
      localAY: localA.y,
      localAZ: localA.z,
      boneB,
      localBX: localB.x,
      localBY: localB.y,
      localBZ: localB.z,
      weightB,
    }));
    this.bindPositions.push(x, y, z);
    return index;
  }

  /** 添加一个具有明确绕序的三角面。 */
  public triangle(surface: number, a: number, b: number, c: number): void {
    this.addPatch({
      kind: VanguardCagePatchKind.Triangle,
      surface,
      a,
      b,
      c,
      d: c,
      ridge: 0,
      flipDiagonal: false,
    });
  }

  /** 添加一个按指定对角线切分的四边面。 */
  public quad(
    surface: number,
    a: number,
    b: number,
    c: number,
    d: number,
    flipDiagonal = false,
  ): void {
    this.addPatch({
      kind: VanguardCagePatchKind.Quad,
      surface,
      a,
      b,
      c,
      d,
      ridge: 0,
      flipDiagonal,
    });
  }

  /** 添加一个以偏移中心形成四个可读切面的四边面。 */
  public facetedQuad(
    surface: number,
    a: number,
    b: number,
    c: number,
    d: number,
    ridge: number,
  ): void {
    this.addPatch({
      kind: VanguardCagePatchKind.FacetedQuad,
      surface,
      a,
      b,
      c,
      d,
      ridge,
      flipDiagonal: false,
    });
  }

  /** 根据绑定姿态中的期望朝外方向自动修正四边面绕序。 */
  public orientedQuad(
    surface: number,
    a: number,
    b: number,
    c: number,
    d: number,
    outwardX: number,
    outwardY: number,
    outwardZ: number,
    ridge = 0,
    flipDiagonal = false,
  ): void {
    const orientation = this.getOrientation(a, b, d, outwardX, outwardY, outwardZ);
    if (Math.abs(ridge) >= FACETED_QUAD_MINIMUM_RIDGE) {
      if (orientation >= 0) {
        this.facetedQuad(surface, a, b, c, d, ridge);
      } else {
        this.facetedQuad(surface, a, d, c, b, ridge);
      }
      return;
    }
    if (orientation >= 0) {
      this.quad(surface, a, b, c, d, flipDiagonal);
    } else {
      this.quad(surface, a, d, c, b, flipDiagonal);
    }
  }

  /** 根据绑定姿态中的期望朝外方向自动修正三角面绕序。 */
  public orientedTriangle(
    surface: number,
    a: number,
    b: number,
    c: number,
    outwardX: number,
    outwardY: number,
    outwardZ: number,
  ): void {
    if (this.getOrientation(a, b, c, outwardX, outwardY, outwardZ) >= 0) {
      this.triangle(surface, a, b, c);
    } else {
      this.triangle(surface, a, c, b);
    }
  }

  /** 冻结并按表面顺序输出完整拓扑笼。 */
  public build(): VanguardCageDefinition {
    const patches: VanguardCagePatch[] = [];
    const surfaceTriangleCounts: number[] = [];
    let triangleCount = 0;
    for (let surface = 0; surface < this.surfaceCount; surface++) {
      const surfacePatches = this.patchesBySurface[surface];
      if (surfacePatches === undefined) {
        throw new Error(`主角拓扑笼表面不存在：${surface}`);
      }
      let surfaceTriangles = 0;
      for (const patch of surfacePatches) {
        patches.push(patch);
        surfaceTriangles += getPatchTriangleCount(patch.kind);
      }
      surfaceTriangleCounts.push(surfaceTriangles);
      triangleCount += surfaceTriangles;
    }
    return Object.freeze({
      vertices: Object.freeze(this.vertices.slice()),
      patches: Object.freeze(patches),
      surfaceTriangleCounts: Object.freeze(surfaceTriangleCounts),
      triangleCount,
    });
  }

  /** 校验顶点和表面索引后记录面片。 */
  private addPatch(patch: VanguardCagePatch): void {
    if (!Number.isInteger(patch.surface)
      || patch.surface < 0
      || patch.surface >= this.surfaceCount) {
      throw new Error(`主角拓扑笼表面索引越界：${patch.surface}`);
    }
    for (const vertex of [patch.a, patch.b, patch.c, patch.d]) {
      if (!Number.isInteger(vertex) || vertex < 0 || vertex >= this.vertices.length) {
        throw new Error(`主角拓扑笼顶点索引越界：${vertex}`);
      }
    }
    const surfacePatches = this.patchesBySurface[patch.surface];
    if (surfacePatches === undefined) {
      throw new Error(`主角拓扑笼表面不存在：${patch.surface}`);
    }
    surfacePatches.push(Object.freeze(patch));
  }

  /** 返回绑定姿态面法线与期望朝外方向的点积。 */
  private getOrientation(
    a: number,
    b: number,
    c: number,
    outwardX: number,
    outwardY: number,
    outwardZ: number,
  ): number {
    const aOffset = a * 3;
    const bOffset = b * 3;
    const cOffset = c * 3;
    const ax = this.bindPositions[aOffset] ?? 0;
    const ay = this.bindPositions[aOffset + 1] ?? 0;
    const az = this.bindPositions[aOffset + 2] ?? 0;
    const abX = (this.bindPositions[bOffset] ?? 0) - ax;
    const abY = (this.bindPositions[bOffset + 1] ?? 0) - ay;
    const abZ = (this.bindPositions[bOffset + 2] ?? 0) - az;
    const acX = (this.bindPositions[cOffset] ?? 0) - ax;
    const acY = (this.bindPositions[cOffset + 1] ?? 0) - ay;
    const acZ = (this.bindPositions[cOffset + 2] ?? 0) - az;
    const normalX = abY * acZ - abZ * acY;
    const normalY = abZ * acX - abX * acZ;
    const normalZ = abX * acY - abY * acX;
    return normalX * outwardX + normalY * outwardY + normalZ * outwardZ;
  }
}

/** 合并多个同表面契约的拓扑笼，并保持全局表面区段连续。 */
export function mergeVanguardCages(
  definitions: readonly VanguardCageDefinition[],
  surfaceCount: number,
): VanguardCageDefinition {
  const vertices: VanguardCageVertexSpec[] = [];
  const patchesBySurface: VanguardCagePatch[][] = Array.from(
    { length: surfaceCount },
    () => [],
  );

  for (const definition of definitions) {
    if (definition.surfaceTriangleCounts.length !== surfaceCount) {
      throw new Error('待合并主角拓扑笼的表面契约不一致。');
    }
    const vertexOffset = vertices.length;
    vertices.push(...definition.vertices);
    for (const patch of definition.patches) {
      const target = patchesBySurface[patch.surface];
      if (target === undefined) {
        throw new Error(`待合并主角拓扑笼表面不存在：${patch.surface}`);
      }
      target.push(Object.freeze({
        ...patch,
        a: patch.a + vertexOffset,
        b: patch.b + vertexOffset,
        c: patch.c + vertexOffset,
        d: patch.d + vertexOffset,
      }));
    }
  }

  const patches: VanguardCagePatch[] = [];
  const surfaceTriangleCounts: number[] = [];
  let triangleCount = 0;
  for (const surfacePatches of patchesBySurface) {
    let surfaceTriangles = 0;
    for (const patch of surfacePatches) {
      patches.push(patch);
      surfaceTriangles += getPatchTriangleCount(patch.kind);
    }
    surfaceTriangleCounts.push(surfaceTriangles);
    triangleCount += surfaceTriangles;
  }
  return Object.freeze({
    vertices: Object.freeze(vertices),
    patches: Object.freeze(patches),
    surfaceTriangleCounts: Object.freeze(surfaceTriangleCounts),
    triangleCount,
  });
}

/** 返回一个面片最终写入的独立三角形数量。 */
export function getPatchTriangleCount(kind: VanguardCagePatchKind): number {
  switch (kind) {
    case VanguardCagePatchKind.Triangle:
      return 1;
    case VanguardCagePatchKind.Quad:
      return 2;
    case VanguardCagePatchKind.FacetedQuad:
      return 4;
  }
}

/** 把绑定姿态世界点投影到指定骨骼的正交局部坐标。 */
function worldToBoneLocal(
  worldX: number,
  worldY: number,
  worldZ: number,
  bone: VanguardBone,
): Readonly<{ x: number; y: number; z: number }> {
  const offset = bone * VANGUARD_BONE_MATRIX_COMPONENTS;
  const relativeX = worldX - (BIND_POSE_MATRICES[offset + 9] ?? 0);
  const relativeY = worldY - (BIND_POSE_MATRICES[offset + 10] ?? 0);
  const relativeZ = worldZ - (BIND_POSE_MATRICES[offset + 11] ?? 0);
  return Object.freeze({
    x: relativeX * (BIND_POSE_MATRICES[offset] ?? 0)
      + relativeY * (BIND_POSE_MATRICES[offset + 1] ?? 0)
      + relativeZ * (BIND_POSE_MATRICES[offset + 2] ?? 0),
    y: relativeX * (BIND_POSE_MATRICES[offset + 3] ?? 0)
      + relativeY * (BIND_POSE_MATRICES[offset + 4] ?? 0)
      + relativeZ * (BIND_POSE_MATRICES[offset + 5] ?? 0),
    z: relativeX * (BIND_POSE_MATRICES[offset + 6] ?? 0)
      + relativeY * (BIND_POSE_MATRICES[offset + 7] ?? 0)
      + relativeZ * (BIND_POSE_MATRICES[offset + 8] ?? 0),
  });
}
