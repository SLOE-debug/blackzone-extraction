import { type EntityRange } from '../../../core/entities/entity-range';
import { MeshDirty } from '../../../core/mesh/mesh-dirty';
import { type MeshEvaluator } from '../../../core/mesh/mesh-evaluator';
import { type VertexStreams } from '../../../core/mesh/vertex-streams';
import { VANGUARD_MANTLE_PARTICLE_COUNT } from '../model/vanguard-mantle-particles';
import { VanguardBone, VANGUARD_BONE_MATRIX_COMPONENTS } from '../model/vanguard-bone';
import { type VanguardState } from '../model/vanguard-state';
import {
  VANGUARD_MANTLE_REST_NORMALS,
  VANGUARD_MANTLE_TRIANGLES,
} from './vanguard-mantle-topology';
import { VanguardRenderVertexKind, type VanguardMeshPlan } from './vanguard-mesh-plan';

const EPSILON = 0.000001;
const COLOR_VARIANT_COUNT = 7;

/** 主角一个领域表面的线性顶点色和分面变化幅度。 */
export interface VanguardSurfacePaletteEntry {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
  readonly facetVariation: number;
}

/** 主角计划使用的按语义索引调色板。 */
export interface VanguardMeshPalette {
  readonly entries: readonly VanguardSurfacePaletteEntry[];
}

/**
 * 对已编译主角网格求值。
 *
 * 每帧仅蒙皮共享控制点、计算 FacetedQuad 派生中心、展开独立顶点并重算法线。
 */
export class VanguardMeshEvaluator
implements MeshEvaluator<VanguardState, VanguardMeshPlan> {
  private readonly deformedControlPositions: Float64Array;
  private readonly facetedCenterPositions: Float64Array;
  private readonly renderPositions: Float64Array;
  private readonly mantleNormalX = new Float64Array(VANGUARD_MANTLE_PARTICLE_COUNT);
  private readonly mantleNormalY = new Float64Array(VANGUARD_MANTLE_PARTICLE_COUNT);
  private readonly mantleNormalZ = new Float64Array(VANGUARD_MANTLE_PARTICLE_COUNT);

  constructor(
    private readonly compiledPlan: Readonly<VanguardMeshPlan>,
    private readonly palette: Readonly<VanguardMeshPalette>,
  ) {
    this.deformedControlPositions = new Float64Array(compiledPlan.controlVertexCount * 3);
    this.facetedCenterPositions = new Float64Array(compiledPlan.facetedCenterA.length * 3);
    this.renderPositions = new Float64Array(compiledPlan.vertexCount * 3);
    validatePalette(compiledPlan, palette);
  }

  /** 根据请求的属性流原地评估一个批次的主角实体。 */
  public evaluate(
    state: VanguardState,
    plan: VanguardMeshPlan,
    streams: VertexStreams,
    range: EntityRange,
    requested: MeshDirty,
  ): MeshDirty {
    if (plan !== this.compiledPlan) {
      throw new Error('主角网格求值器收到的计划与初始化计划不一致。');
    }
    validateStreamCapacity(streams, plan.vertexCount * range.count);

    let changed = MeshDirty.None;
    const requestedPose = requested & MeshDirty.Pose;
    if (requestedPose !== MeshDirty.None && requestedPose !== MeshDirty.Pose) {
      throw new Error('主角姿态几何必须同时请求 Position 和 Normal 流。');
    }
    if (requestedPose === MeshDirty.Pose) {
      for (let localEntity = 0; localEntity < range.count; localEntity++) {
        const entityIndex = range.start + localEntity;
        const vertexOffset = localEntity * plan.vertexCount;
        this.evaluateGeometry(state, entityIndex, streams, vertexOffset);
      }
      changed |= MeshDirty.Pose;
    }
    if ((requested & MeshDirty.Color) !== MeshDirty.None) {
      this.evaluateColors(streams.colors, range.count);
      changed |= MeshDirty.Color;
    }
    if ((requested & MeshDirty.Bounds) !== MeshDirty.None) {
      changed |= MeshDirty.Bounds;
    }
    return changed;
  }

  /** 求值一个实体的控制点、派生中心、独立位置和硬分面法线。 */
  private evaluateGeometry(
    state: VanguardState,
    entityIndex: number,
    streams: VertexStreams,
    vertexOffset: number,
  ): void {
    this.skinControlVertices(state, entityIndex);
    this.applyMantleControls(state, entityIndex);
    this.evaluateFacetedCenters();
    this.expandRenderPositions(streams.positions, vertexOffset);
    this.computeFlatNormals(streams.normals, vertexOffset);
  }

  /** 用角色本地披风中面和粒子法线覆盖骨骼蒙皮后的自由披片控制点。 */
  private applyMantleControls(state: VanguardState, entityIndex: number): void {
    const plan = this.compiledPlan;
    const { transform, morphology, mantle } = state.data;
    const particleOffset = entityIndex * VANGUARD_MANTLE_PARTICLE_COUNT;
    this.evaluateMantleParticleNormals(state, particleOffset);
    const rootX = transform.x[entityIndex] ?? 0;
    const rootY = transform.y[entityIndex] ?? 0;
    const rootZ = transform.z[entityIndex] ?? 0;
    const heading = transform.heading[entityIndex] ?? 0;
    const scale = morphology.scale[entityIndex] ?? 1;
    const headingCosine = Math.cos(heading);
    const headingSine = Math.sin(heading);
    for (let binding = 0; binding < plan.mantleControlVertices.length; binding++) {
      const controlOffset = (plan.mantleControlVertices[binding] ?? 0) * 3;
      const particle = particleOffset + (plan.mantleParticleIndices[binding] ?? 0);
      const localParticle = plan.mantleParticleIndices[binding] ?? 0;
      const normalOffset = plan.mantleNormalOffsets[binding] ?? 0;
      const localX = (mantle.positionX[particle] ?? 0)
        + (this.mantleNormalX[localParticle] ?? 0) * normalOffset;
      const localY = (mantle.positionY[particle] ?? 0)
        + (this.mantleNormalY[localParticle] ?? 0) * normalOffset;
      const localZ = (mantle.positionZ[particle] ?? 0)
        + (this.mantleNormalZ[localParticle] ?? 1) * normalOffset;
      this.deformedControlPositions[controlOffset] = rootX
        + (localX * headingCosine + localZ * headingSine) * scale;
      this.deformedControlPositions[controlOffset + 1] = rootY + localY * scale;
      this.deformedControlPositions[controlOffset + 2] = rootZ
        + (-localX * headingSine + localZ * headingCosine) * scale;
    }
  }

  /** 从当前披风中面三角形计算生成正反厚度所需的粒子法线。 */
  private evaluateMantleParticleNormals(state: VanguardState, particleOffset: number): void {
    this.mantleNormalX.fill(0);
    this.mantleNormalY.fill(0);
    this.mantleNormalZ.fill(0);
    const mantle = state.data.mantle;
    for (let triangle = 0; triangle < VANGUARD_MANTLE_TRIANGLES.length; triangle += 3) {
      const localA = VANGUARD_MANTLE_TRIANGLES[triangle] ?? 0;
      const localB = VANGUARD_MANTLE_TRIANGLES[triangle + 1] ?? 0;
      const localC = VANGUARD_MANTLE_TRIANGLES[triangle + 2] ?? 0;
      const a = particleOffset + localA;
      const b = particleOffset + localB;
      const c = particleOffset + localC;
      const abX = (mantle.positionX[b] ?? 0) - (mantle.positionX[a] ?? 0);
      const abY = (mantle.positionY[b] ?? 0) - (mantle.positionY[a] ?? 0);
      const abZ = (mantle.positionZ[b] ?? 0) - (mantle.positionZ[a] ?? 0);
      const acX = (mantle.positionX[c] ?? 0) - (mantle.positionX[a] ?? 0);
      const acY = (mantle.positionY[c] ?? 0) - (mantle.positionY[a] ?? 0);
      const acZ = (mantle.positionZ[c] ?? 0) - (mantle.positionZ[a] ?? 0);
      const normalX = abY * acZ - abZ * acY;
      const normalY = abZ * acX - abX * acZ;
      const normalZ = abX * acY - abY * acX;
      this.accumulateMantleNormal(localA, normalX, normalY, normalZ);
      this.accumulateMantleNormal(localB, normalX, normalY, normalZ);
      this.accumulateMantleNormal(localC, normalX, normalY, normalZ);
    }
    for (let particle = 0; particle < VANGUARD_MANTLE_PARTICLE_COUNT; particle++) {
      let normalX = this.mantleNormalX[particle] ?? 0;
      let normalY = this.mantleNormalY[particle] ?? 0;
      let normalZ = this.mantleNormalZ[particle] ?? 0;
      const inverseLength = 1 / Math.max(Math.hypot(normalX, normalY, normalZ), EPSILON);
      normalX *= inverseLength;
      normalY *= inverseLength;
      normalZ *= inverseLength;
      const referenceDot = normalX * (VANGUARD_MANTLE_REST_NORMALS.x[particle] ?? 0)
        + normalY * (VANGUARD_MANTLE_REST_NORMALS.y[particle] ?? 0)
        + normalZ * (VANGUARD_MANTLE_REST_NORMALS.z[particle] ?? 1);
      const direction = referenceDot < 0 ? -1 : 1;
      this.mantleNormalX[particle] = normalX * direction;
      this.mantleNormalY[particle] = normalY * direction;
      this.mantleNormalZ[particle] = normalZ * direction;
    }
  }

  private accumulateMantleNormal(
    particle: number,
    normalX: number,
    normalY: number,
    normalZ: number,
  ): void {
    this.mantleNormalX[particle] = (this.mantleNormalX[particle] ?? 0) + normalX;
    this.mantleNormalY[particle] = (this.mantleNormalY[particle] ?? 0) + normalY;
    this.mantleNormalZ[particle] = (this.mantleNormalZ[particle] ?? 0) + normalZ;
  }

  /** 将全部绑定控制点按最多两根骨骼混合到当前世界空间。 */
  private skinControlVertices(state: VanguardState, entityIndex: number): void {
    const { controlVertexCount, controlBoneA, controlBoneB, controlLocalA, controlLocalB,
      controlWeightB } = this.compiledPlan;
    const matrices = state.data.pose.boneMatrices;
    const entityMatrixOffset = entityIndex
      * VANGUARD_BONE_MATRIX_COMPONENTS
      * VanguardBone.Count;

    for (let vertex = 0; vertex < controlVertexCount; vertex++) {
      const localOffset = vertex * 3;
      const matrixA = entityMatrixOffset
        + (controlBoneA[vertex] ?? 0) * VANGUARD_BONE_MATRIX_COMPONENTS;
      const ax = transformX(
        matrices,
        matrixA,
        controlLocalA[localOffset] ?? 0,
        controlLocalA[localOffset + 1] ?? 0,
        controlLocalA[localOffset + 2] ?? 0,
      );
      const ay = transformY(
        matrices,
        matrixA,
        controlLocalA[localOffset] ?? 0,
        controlLocalA[localOffset + 1] ?? 0,
        controlLocalA[localOffset + 2] ?? 0,
      );
      const az = transformZ(
        matrices,
        matrixA,
        controlLocalA[localOffset] ?? 0,
        controlLocalA[localOffset + 1] ?? 0,
        controlLocalA[localOffset + 2] ?? 0,
      );
      const weightB = controlWeightB[vertex] ?? 0;
      if (weightB <= 0) {
        this.deformedControlPositions[localOffset] = ax;
        this.deformedControlPositions[localOffset + 1] = ay;
        this.deformedControlPositions[localOffset + 2] = az;
        continue;
      }
      const matrixB = entityMatrixOffset
        + (controlBoneB[vertex] ?? 0) * VANGUARD_BONE_MATRIX_COMPONENTS;
      const weightA = 1 - weightB;
      this.deformedControlPositions[localOffset] = ax * weightA
        + transformX(
          matrices,
          matrixB,
          controlLocalB[localOffset] ?? 0,
          controlLocalB[localOffset + 1] ?? 0,
          controlLocalB[localOffset + 2] ?? 0,
        ) * weightB;
      this.deformedControlPositions[localOffset + 1] = ay * weightA
        + transformY(
          matrices,
          matrixB,
          controlLocalB[localOffset] ?? 0,
          controlLocalB[localOffset + 1] ?? 0,
          controlLocalB[localOffset + 2] ?? 0,
        ) * weightB;
      this.deformedControlPositions[localOffset + 2] = az * weightA
        + transformZ(
          matrices,
          matrixB,
          controlLocalB[localOffset] ?? 0,
          controlLocalB[localOffset + 1] ?? 0,
          controlLocalB[localOffset + 2] ?? 0,
        ) * weightB;
    }
  }

  /** 根据四角与当前面法线重建全部 FacetedQuad 派生中心。 */
  private evaluateFacetedCenters(): void {
    const plan = this.compiledPlan;
    for (let center = 0; center < plan.facetedCenterA.length; center++) {
      const aOffset = (plan.facetedCenterA[center] ?? 0) * 3;
      const bOffset = (plan.facetedCenterB[center] ?? 0) * 3;
      const cOffset = (plan.facetedCenterC[center] ?? 0) * 3;
      const dOffset = (plan.facetedCenterD[center] ?? 0) * 3;
      const ax = this.deformedControlPositions[aOffset] ?? 0;
      const ay = this.deformedControlPositions[aOffset + 1] ?? 0;
      const az = this.deformedControlPositions[aOffset + 2] ?? 0;
      const bx = this.deformedControlPositions[bOffset] ?? 0;
      const by = this.deformedControlPositions[bOffset + 1] ?? 0;
      const bz = this.deformedControlPositions[bOffset + 2] ?? 0;
      const cx = this.deformedControlPositions[cOffset] ?? 0;
      const cy = this.deformedControlPositions[cOffset + 1] ?? 0;
      const cz = this.deformedControlPositions[cOffset + 2] ?? 0;
      const dx = this.deformedControlPositions[dOffset] ?? 0;
      const dy = this.deformedControlPositions[dOffset + 1] ?? 0;
      const dz = this.deformedControlPositions[dOffset + 2] ?? 0;
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
      const targetOffset = center * 3;
      const ridge = plan.facetedCenterRidges[center] ?? 0;
      this.facetedCenterPositions[targetOffset] = (ax + bx + cx + dx) * 0.25 + normalX * ridge;
      this.facetedCenterPositions[targetOffset + 1] = (ay + by + cy + dy) * 0.25 + normalY * ridge;
      this.facetedCenterPositions[targetOffset + 2] = (az + bz + cz + dz) * 0.25 + normalZ * ridge;
    }
  }

  /** 将控制点和派生中心指令展开为最终独立顶点位置流。 */
  private expandRenderPositions(positions: Float32Array, vertexOffset: number): void {
    const plan = this.compiledPlan;
    for (let vertex = 0; vertex < plan.vertexCount; vertex++) {
      const sourceOffset = (plan.renderVertexKinds[vertex] === VanguardRenderVertexKind.Control
        ? (plan.renderToControlVertex[vertex] ?? 0)
        : (plan.renderToFacetedCenter[vertex] ?? 0)) * 3;
      const source = plan.renderVertexKinds[vertex] === VanguardRenderVertexKind.Control
        ? this.deformedControlPositions
        : this.facetedCenterPositions;
      const renderOffset = vertex * 3;
      const targetOffset = (vertexOffset + vertex) * 3;
      const x = source[sourceOffset] ?? 0;
      const y = source[sourceOffset + 1] ?? 0;
      const z = source[sourceOffset + 2] ?? 0;
      this.renderPositions[renderOffset] = x;
      this.renderPositions[renderOffset + 1] = y;
      this.renderPositions[renderOffset + 2] = z;
      positions[targetOffset] = x;
      positions[targetOffset + 1] = y;
      positions[targetOffset + 2] = z;
    }
  }

  /** 从双精度展开位置计算每组三个独立顶点的硬分面法线。 */
  private computeFlatNormals(normals: Float32Array, vertexOffset: number): void {
    for (let offset = 0; offset < this.renderPositions.length; offset += 9) {
      const ax = this.renderPositions[offset] ?? 0;
      const ay = this.renderPositions[offset + 1] ?? 0;
      const az = this.renderPositions[offset + 2] ?? 0;
      const edgeABX = (this.renderPositions[offset + 3] ?? 0) - ax;
      const edgeABY = (this.renderPositions[offset + 4] ?? 0) - ay;
      const edgeABZ = (this.renderPositions[offset + 5] ?? 0) - az;
      const edgeACX = (this.renderPositions[offset + 6] ?? 0) - ax;
      const edgeACY = (this.renderPositions[offset + 7] ?? 0) - ay;
      const edgeACZ = (this.renderPositions[offset + 8] ?? 0) - az;
      const crossX = edgeABY * edgeACZ - edgeABZ * edgeACY;
      const crossY = edgeABZ * edgeACX - edgeABX * edgeACZ;
      const crossZ = edgeABX * edgeACY - edgeABY * edgeACX;
      const inverseLength = 1 / Math.max(Math.hypot(crossX, crossY, crossZ), EPSILON);
      const normalX = crossX * inverseLength;
      const normalY = crossY * inverseLength;
      const normalZ = crossZ * inverseLength;
      const firstVertex = vertexOffset + offset / 3;
      for (let vertex = 0; vertex < 3; vertex++) {
        const targetOffset = (firstVertex + vertex) * 3;
        normals[targetOffset] = normalX;
        normals[targetOffset + 1] = normalY;
        normals[targetOffset + 2] = normalZ;
      }
    }
  }

  /** 在初始化或显式颜色事件中写入稳定的语义配色。 */
  private evaluateColors(colors: Float32Array, entityCount: number): void {
    const plan = this.compiledPlan;
    const trianglesPerEntity = plan.vertexCount / 3;
    for (let entity = 0; entity < entityCount; entity++) {
      const vertexOffset = entity * plan.vertexCount;
      const entityVariantOffset = entity * trianglesPerEntity;
      for (let vertex = 0; vertex < plan.vertexCount; vertex++) {
        const semantic = plan.semanticIds[vertex] ?? 0;
        const color = this.palette.entries[semantic];
        if (color === undefined) {
          throw new Error(`主角表面调色板不存在：${semantic}`);
        }
        const variant = ((plan.colorVariantIds[vertex] ?? 0) + entityVariantOffset)
          % COLOR_VARIANT_COUNT;
        const shade = 1 - color.facetVariation * 0.55
          + variant / (COLOR_VARIANT_COUNT - 1) * color.facetVariation;
        const offset = (vertexOffset + vertex) * 4;
        colors[offset] = Math.min(1, color.red * shade);
        colors[offset + 1] = Math.min(1, color.green * shade);
        colors[offset + 2] = Math.min(1, color.blue * shade);
        colors[offset + 3] = color.alpha;
      }
    }
  }
}

/** 验证运行时流能够容纳整个实体范围。 */
function validateStreamCapacity(streams: VertexStreams, vertexCount: number): void {
  if (streams.positions.length < vertexCount * 3
    || streams.normals.length < vertexCount * 3
    || streams.colors.length < vertexCount * 4) {
    throw new Error('主角网格运行时顶点流容量不足。');
  }
}

/** 验证每个编译语义都拥有颜色和有效变化幅度。 */
function validatePalette(plan: Readonly<VanguardMeshPlan>, palette: Readonly<VanguardMeshPalette>): void {
  for (const span of plan.semanticSpans) {
    const entry = palette.entries[span.semantic];
    if (entry === undefined || !Number.isFinite(entry.facetVariation)
      || entry.facetVariation < 0 || entry.facetVariation > 1) {
      throw new Error(`主角表面调色板无效：${span.semantic}`);
    }
  }
}

/** 计算仿射骨骼变换后的 X 分量。 */
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

/** 计算仿射骨骼变换后的 Y 分量。 */
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

/** 计算仿射骨骼变换后的 Z 分量。 */
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
