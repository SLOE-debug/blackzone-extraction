/**
 * 定义需要显式释放所持资源的对象契约。
 */
export interface Disposable {
  /** 释放对象持有的运行时资源，重复调用不得产生额外副作用。 */
  dispose(): void;
}
