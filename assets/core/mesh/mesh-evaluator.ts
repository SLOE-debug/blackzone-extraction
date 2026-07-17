import { type EntityRange } from '../entities/entity-range';
import { type MeshDirty } from './mesh-dirty';
import { type MeshPlan } from './mesh-plan';
import { type VertexStreams } from './vertex-streams';

/**
 * 将领域状态求值为一个实体范围的动态顶点流。
 *
 * Evaluator 只可修改 requested 所允许的流；返回值必须准确描述实际发生变化的流，
 * 以便渲染器跳过不必要的 GPU 上传。
 *
 * @typeParam TState Evaluator 读取的领域状态或 SoA 数据表类型。
 * @typeParam TPlan 该 Evaluator 使用的单实体编译网格计划类型。
 */
export interface MeshEvaluator<TState, TPlan extends MeshPlan> {
  /**
   * 原地求值指定实体范围的动态顶点流。
   *
   * @param state 当前领域状态。
   * @param plan 单实体局部网格计划。
   * @param streams 当前批次有效范围的可写顶点流。
   * @param range 该批次在领域状态中的连续实体范围。
   * @param requested 调用方请求重新求值的流位标志。
   * @returns 实际改写的流和包围盒位标志。
   */
  evaluate(
    state: TState,
    plan: TPlan,
    streams: VertexStreams,
    range: EntityRange,
    requested: MeshDirty,
  ): MeshDirty;
}
