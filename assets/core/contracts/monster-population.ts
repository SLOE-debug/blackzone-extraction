import type { Disposable } from './disposable';

/**
 * 定义一组同类怪物的运行时控制接口。
 *
 * @typeParam TCommand 该怪物群体能够接收的强类型命令。
 */
export interface MonsterPopulation<TCommand> extends Disposable {
  /** 当前群体包含的实体数量。 */
  readonly count: number;

  /**
   * 推进群体的行为、移动、动画和渲染状态。
   *
   * @param deltaTime 自上一帧以来经过的秒数。
   */
  update(deltaTime: number): void;

  /**
   * 向群体发送领域命令。
   *
   * @param command 当前怪物类型声明的命令。
   */
  dispatch(command: TCommand): void;
}
