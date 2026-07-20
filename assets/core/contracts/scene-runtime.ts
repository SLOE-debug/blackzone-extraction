import { type Disposable } from './disposable';

/** 可由主场景流程接管和释放的运行时场景。 */
export interface SceneRuntime extends Disposable {
  /** 推进当前场景的动态系统。 */
  update(deltaTime: number): void;
}
