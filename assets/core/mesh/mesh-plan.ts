/** 单实体局部网格计划支持的索引缓冲类型。 */
export type MeshPlanIndexArray = Uint16Array | Uint32Array;

/**
 * 描述一个实体在编译阶段确定的局部拓扑。
 *
 * 索引始终相对于单个实体的顶点起点；批渲染器负责在初始化时将其复制并偏移。
 */
export interface MeshPlan {
  /** 单个实体占用的最终渲染顶点数量。 */
  readonly vertexCount: number;
  /** 单个实体占用的索引数量。 */
  readonly indexCount: number;
  /** 相对于单实体顶点起点的固定索引。 */
  readonly indices: MeshPlanIndexArray;
}

/**
 * 验证单实体局部网格计划的计数和索引范围。
 *
 * @param plan 待用于批渲染的编译后网格计划。
 * @returns 无返回值；无异常时计划可安全参与索引复制。
 */
export function assertMeshPlan(plan: MeshPlan): void {
  if (!Number.isInteger(plan.vertexCount) || plan.vertexCount < 0) {
    throw new Error('网格计划的顶点数量必须是非负整数。');
  }
  if (!Number.isInteger(plan.indexCount) || plan.indexCount < 0) {
    throw new Error('网格计划的索引数量必须是非负整数。');
  }
  if (!(plan.indices instanceof Uint16Array) && !(plan.indices instanceof Uint32Array)) {
    throw new Error('网格计划索引必须使用 Uint16Array 或 Uint32Array。');
  }
  if (plan.indices.length !== plan.indexCount) {
    throw new Error('网格计划索引缓冲长度必须与索引数量一致。');
  }

  for (let indexOffset = 0; indexOffset < plan.indexCount; indexOffset++) {
    const localIndex = plan.indices[indexOffset];
    if (localIndex === undefined || localIndex >= plan.vertexCount) {
      throw new Error(`网格计划包含越界的局部顶点索引：${indexOffset}`);
    }
  }
}
