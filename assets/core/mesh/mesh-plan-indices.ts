import {
  assertMeshPlan,
  type MeshPlan,
  type MeshPlanIndexArray,
} from './mesh-plan';

/**
 * 将单实体局部索引复制为连续实体批次的全局索引。
 *
 * 每个实体都使用同一份局部拓扑，函数会按其顶点数量自动增加索引偏移。
 *
 * @param plan 单实体局部网格计划。
 * @param entityCount 需要写入同一批次的连续实体数量。
 * @param target 接收批次全局索引的 Uint16 或 Uint32 缓冲。
 * @returns 无返回值；无异常时目标缓冲前部已写入全部批次索引。
 */
export function copyMeshPlanIndices(
  plan: MeshPlan,
  entityCount: number,
  target: MeshPlanIndexArray,
): void {
  assertMeshPlan(plan);
  if (!Number.isInteger(entityCount) || entityCount < 0) {
    throw new Error('批次实体数量必须是非负整数。');
  }
  if (!(target instanceof Uint16Array) && !(target instanceof Uint32Array)) {
    throw new Error('批次索引缓冲必须使用 Uint16Array 或 Uint32Array。');
  }

  const requiredIndexCount = multiplyCounts(plan.indexCount, entityCount, '批次索引数量');
  const requiredVertexCount = multiplyCounts(plan.vertexCount, entityCount, '批次顶点数量');
  if (target.length < requiredIndexCount) {
    throw new Error('批次索引缓冲容量不足。');
  }

  const maximumIndex = target instanceof Uint16Array ? 0xffff : 0xffffffff;
  if (requiredVertexCount > maximumIndex + 1) {
    throw new Error('批次顶点数量超过目标索引格式可表达范围。');
  }

  for (let entity = 0; entity < entityCount; entity++) {
    const vertexOffset = entity * plan.vertexCount;
    const targetOffset = entity * plan.indexCount;
    for (let indexOffset = 0; indexOffset < plan.indexCount; indexOffset++) {
      const localIndex = plan.indices[indexOffset];
      if (localIndex === undefined) {
        throw new Error(`网格计划局部索引不存在：${indexOffset}`);
      }
      const targetIndex = vertexOffset + localIndex;
      if (targetIndex > maximumIndex) {
        throw new Error('批次索引超过目标索引格式可表达范围。');
      }
      target[targetOffset + indexOffset] = targetIndex;
    }
  }
}

/** 计算不会超过 JavaScript 安全整数范围的批次容量。 */
function multiplyCounts(left: number, right: number, description: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${description}超过安全整数范围。`);
  }
  return result;
}
