/**
 * 定义按批次推进实体状态的系统契约。
 *
 * @typeParam TState 系统能够访问的实体状态。
 * @typeParam TContext 单次更新所需的只读上下文。
 */
export interface EntitySystem<TState, TContext> {
  /**
   * 更新系统负责的状态切片。
   *
   * @param state 系统操作的实体状态。
   * @param context 当前更新上下文。
   */
  update(state: TState, context: Readonly<TContext>): void;
}
