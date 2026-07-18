import { type MeshPlan } from '../../../core/mesh/mesh-plan';

/** 主角最终渲染顶点的求值来源。 */
export const enum VanguardRenderVertexKind {
  /** 直接读取一个已经蒙皮的共享控制点。 */
  Control,
  /** 由四个已经蒙皮的控制点和固定 ridge 推导中心点。 */
  FacetedCenter,
}

/** 一个语义表面在单实体最终顶点流中的连续范围。 */
export interface VanguardSemanticSpan {
  readonly semantic: number;
  readonly startVertex: number;
  readonly vertexCount: number;
}

/**
 * 主角硬分面控制笼的编译结果。
 *
 * 所有数组均描述单个实体；批处理阶段只复制索引并按实体调用同一求值计划。
 */
export interface VanguardMeshPlan extends MeshPlan {
  /** 共享控制笼顶点数量。 */
  readonly controlVertexCount: number;
  /** 第一骨骼索引。 */
  readonly controlBoneA: Uint8Array;
  /** 第二骨骼索引。 */
  readonly controlBoneB: Uint8Array;
  /** 第一骨骼绑定局部坐标。 */
  readonly controlLocalA: Float64Array;
  /** 第二骨骼绑定局部坐标。 */
  readonly controlLocalB: Float64Array;
  /** 第二骨骼权重。 */
  readonly controlWeightB: Float64Array;
  /** 需要由披风粒子覆盖的共享控制点索引。 */
  readonly mantleControlVertices: Uint16Array;
  /** 每个披风控制点读取的中面粒子索引。 */
  readonly mantleParticleIndices: Uint8Array;
  /** 每个披风控制点沿粒子法线生成厚度的有符号偏移。 */
  readonly mantleNormalOffsets: Float32Array;
  /** 最终顶点的直接控制点或派生中心点标识。 */
  readonly renderVertexKinds: Uint8Array;
  /** 直接控制点顶点对应的共享控制点索引。 */
  readonly renderToControlVertex: Uint16Array;
  /** 派生中心点顶点对应的中心配方索引。 */
  readonly renderToFacetedCenter: Uint16Array;
  /** 每个派生中心点的第一个控制点索引。 */
  readonly facetedCenterA: Uint16Array;
  /** 每个派生中心点的第二个控制点索引。 */
  readonly facetedCenterB: Uint16Array;
  /** 每个派生中心点的第三个控制点索引。 */
  readonly facetedCenterC: Uint16Array;
  /** 每个派生中心点的第四个控制点索引。 */
  readonly facetedCenterD: Uint16Array;
  /** 每个派生中心点沿当前面法线的固定隆起量。 */
  readonly facetedCenterRidges: Float64Array;
  /** 每个最终顶点所属的领域表面语义。 */
  readonly semanticIds: Uint8Array;
  /** 每个最终顶点的确定性分面颜色变体。 */
  readonly colorVariantIds: Uint8Array;
  /** 按表面顺序连续排列的语义范围。 */
  readonly semanticSpans: readonly VanguardSemanticSpan[];
}
