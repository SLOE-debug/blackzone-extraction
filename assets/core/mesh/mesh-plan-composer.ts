import { GeometryIndexFormat } from '../geometry/buffer-geometry';
import {
  assertMeshPlan,
  type MeshPlan,
  type MeshPlanIndexArray,
} from './mesh-plan';

/** 一个需要按固定次数重复并接入统一索引空间的局部计划。 */
export interface RepeatedMeshPlanPart<TId, TPlan extends MeshPlan> {
  readonly id: TId;
  readonly plan: TPlan;
  readonly repeatCount: number;
}

/** 一个重复局部计划在组合结果中的连续区段。 */
export interface RepeatedMeshPlanSection<TId, TPlan extends MeshPlan> {
  readonly id: TId;
  readonly plan: TPlan;
  readonly repeatCount: number;
  readonly vertexOffset: number;
  readonly vertexCount: number;
  readonly indexOffset: number;
  readonly indexCount: number;
}

/** 多组重复计划共享的一份固定索引拓扑及其区段。 */
export interface ComposedRepeatedMeshPlan<TId, TPlan extends MeshPlan>
  extends MeshPlan {
  readonly sections: readonly RepeatedMeshPlanSection<TId, TPlan>[];
}

/**
 * 将多组局部计划按重复次数组合到一个连续索引空间。
 *
 * 核心层只负责计数、偏移、索引格式和容量校验，不解释 Feature 的原型或实体策略。
 */
export function composeRepeatedMeshPlans<TId, TPlan extends MeshPlan>(
  parts: readonly RepeatedMeshPlanPart<TId, TPlan>[],
  indexFormat: GeometryIndexFormat,
): ComposedRepeatedMeshPlan<TId, TPlan> {
  if (parts.length === 0) {
    throw new Error('重复网格计划组合至少需要一个区段。');
  }

  const sections: RepeatedMeshPlanSection<TId, TPlan>[] = [];
  let vertexCount = 0;
  let indexCount = 0;
  for (const part of parts) {
    assertMeshPlan(part.plan);
    if (!Number.isInteger(part.repeatCount) || part.repeatCount <= 0) {
      throw new Error('重复网格计划的重复次数必须是正整数。');
    }
    const sectionVertexCount = multiplySafe(
      part.plan.vertexCount,
      part.repeatCount,
      '区段顶点数量',
    );
    const sectionIndexCount = multiplySafe(
      part.plan.indexCount,
      part.repeatCount,
      '区段索引数量',
    );
    sections.push(Object.freeze({
      id: part.id,
      plan: part.plan,
      repeatCount: part.repeatCount,
      vertexOffset: vertexCount,
      vertexCount: sectionVertexCount,
      indexOffset: indexCount,
      indexCount: sectionIndexCount,
    }));
    vertexCount = addSafe(vertexCount, sectionVertexCount, '组合顶点数量');
    indexCount = addSafe(indexCount, sectionIndexCount, '组合索引数量');
  }

  const maximumVertexCount = indexFormat === GeometryIndexFormat.Uint16
    ? 0x10000
    : 0x100000000;
  if (vertexCount > maximumVertexCount) {
    throw new Error('组合顶点数量超过目标索引格式可表达范围。');
  }
  const indices = createIndexArray(indexCount, indexFormat);
  writeComposedIndices(sections, indices);
  return Object.freeze({
    sections: Object.freeze(sections),
    vertexCount,
    indexCount,
    indices,
  });
}

/** 把各区段的局部索引写为带区段和实例偏移的全局索引。 */
function writeComposedIndices<TId, TPlan extends MeshPlan>(
  sections: readonly RepeatedMeshPlanSection<TId, TPlan>[],
  target: MeshPlanIndexArray,
): void {
  const maximumIndex = target instanceof Uint16Array ? 0xffff : 0xffffffff;
  for (const section of sections) {
    for (let repeat = 0; repeat < section.repeatCount; repeat++) {
      const vertexOffset = section.vertexOffset + repeat * section.plan.vertexCount;
      const indexOffset = section.indexOffset + repeat * section.plan.indexCount;
      for (let localOffset = 0; localOffset < section.plan.indexCount; localOffset++) {
        const localIndex = section.plan.indices[localOffset];
        if (localIndex === undefined) {
          throw new Error(`重复网格计划局部索引不存在：${localOffset}。`);
        }
        const targetIndex = vertexOffset + localIndex;
        if (targetIndex > maximumIndex) {
          throw new Error('组合索引超过目标索引格式可表达范围。');
        }
        target[indexOffset + localOffset] = targetIndex;
      }
    }
  }
}

/** 创建目标格式的精确长度索引缓冲。 */
function createIndexArray(
  indexCount: number,
  indexFormat: GeometryIndexFormat,
): MeshPlanIndexArray {
  if (indexCount > 0xffffffff) {
    throw new Error('组合索引数量超过 TypedArray 可表达范围。');
  }
  return indexFormat === GeometryIndexFormat.Uint16
    ? new Uint16Array(indexCount)
    : new Uint32Array(indexCount);
}

/** 计算不会超过 JavaScript 安全整数范围的乘积。 */
function multiplySafe(left: number, right: number, description: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result) || result <= 0) {
    throw new Error(`${description}无效。`);
  }
  return result;
}

/** 计算不会超过 JavaScript 安全整数范围的和。 */
function addSafe(left: number, right: number, description: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result <= 0) {
    throw new Error(`${description}无效。`);
  }
  return result;
}
