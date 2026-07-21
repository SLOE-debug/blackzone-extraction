import { type Disposable } from '../contracts/disposable';
import {
  toChunkCoordinateKey,
  type ChunkCoordinate,
  type ChunkCoordinateKey,
} from './chunk-coordinate';
import { type ChunkWindowTransition } from './chunk-window-tracker';

/** 一个 Chunk 内部资源的统一所有权作用域。 */
export interface ChunkRuntimeScope {
  readonly chunk: Readonly<ChunkCoordinate>;

  /**
   * 把运行时资源归属于当前 Chunk。
   *
   * Chunk 离开活动窗口时，资源会按登记的相反顺序自动释放。
   */
  own<TResource extends Disposable>(resource: TResource): TResource;
}

/** 可向任意 Chunk 注入运行时对象的模块化参与者。 */
export interface ChunkRuntimeParticipant<TContext> {
  /** 根据场景上下文向新加载 Chunk 的作用域登记资源。 */
  populate(scope: ChunkRuntimeScope, context: TContext): void;
}

/**
 * 将 Chunk 窗口差集转换为通用资源作用域的创建与释放。
 *
 * 注册者不需要知道其他系统的存在；怪物、宝箱、特效和任务对象可以共享同一套
 * 卸载语义，避免各自在场景入口编写容易遗漏的清理分支。
 */
export class ChunkRuntimeRegistry<TContext> implements Disposable {
  private readonly participants: ChunkRuntimeParticipant<TContext>[] = [];
  private readonly scopes = new Map<ChunkCoordinateKey, OwnedChunkRuntimeScope>();
  private synchronizationStarted = false;
  private disposed = false;

  /** 当前仍由窗口持有的 Chunk 作用域数量。 */
  public get activeScopeCount(): number {
    return this.scopes.size;
  }

  /** 在首次窗口同步前登记一个 Chunk 内容参与者。 */
  public register(participant: ChunkRuntimeParticipant<TContext>): void {
    this.ensureActive();
    if (this.synchronizationStarted) {
      throw new Error('Chunk 运行时开始同步后不能再登记参与者。');
    }
    if (this.participants.includes(participant)) {
      throw new Error('同一个 Chunk 运行时参与者不能重复登记。');
    }
    this.participants.push(participant);
  }

  /** 按窗口差集先构造新增作用域，成功后再释放离开窗口的作用域。 */
  public synchronize(
    transition: Readonly<ChunkWindowTransition>,
    context: TContext,
  ): void {
    this.ensureActive();
    this.synchronizationStarted = true;
    this.validateTransition(transition);

    const pendingScopes: OwnedChunkRuntimeScope[] = [];
    try {
      for (const chunk of transition.added) {
        const scope = new OwnedChunkRuntimeScope(chunk);
        pendingScopes.push(scope);
        for (const participant of this.participants) {
          participant.populate(scope, context);
        }
      }
    } catch (error: unknown) {
      disposeScopes(pendingScopes);
      throw error;
    }

    for (const scope of pendingScopes) {
      this.scopes.set(toChunkCoordinateKey(scope.chunk), scope);
    }
    for (const chunk of transition.removed) {
      const key = toChunkCoordinateKey(chunk);
      const scope = this.scopes.get(key);
      if (scope === undefined) {
        throw new Error('Chunk 窗口差集尝试卸载不存在的运行时作用域。');
      }
      this.scopes.delete(key);
      scope.dispose();
    }
  }

  /** 释放仍处于活动窗口内的全部 Chunk 作用域。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    const activeScopes = Array.from(this.scopes.values());
    this.scopes.clear();
    disposeScopes(activeScopes);
    this.participants.length = 0;
  }

  private validateTransition(transition: Readonly<ChunkWindowTransition>): void {
    const addedKeys = new Set<ChunkCoordinateKey>();
    for (const chunk of transition.added) {
      const key = toChunkCoordinateKey(chunk);
      if (this.scopes.has(key) || addedKeys.has(key)) {
        throw new Error('Chunk 窗口差集包含重复或已经加载的新增坐标。');
      }
      addedKeys.add(key);
    }
    const removedKeys = new Set<ChunkCoordinateKey>();
    for (const chunk of transition.removed) {
      const key = toChunkCoordinateKey(chunk);
      if (!this.scopes.has(key) || removedKeys.has(key) || addedKeys.has(key)) {
        throw new Error('Chunk 窗口差集包含重复、冲突或尚未加载的移除坐标。');
      }
      removedKeys.add(key);
    }
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('Chunk 运行时注册表已经释放。');
    }
  }
}

class OwnedChunkRuntimeScope implements ChunkRuntimeScope, Disposable {
  public readonly chunk: Readonly<ChunkCoordinate>;
  private readonly resources: Disposable[] = [];
  private disposed = false;

  constructor(chunk: Readonly<ChunkCoordinate>) {
    this.chunk = chunk;
  }

  public own<TResource extends Disposable>(resource: TResource): TResource {
    if (this.disposed) {
      throw new Error('已经卸载的 Chunk 作用域不能再持有资源。');
    }
    this.resources.push(resource);
    return resource;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (let index = this.resources.length - 1; index >= 0; index--) {
      this.resources[index]?.dispose();
    }
    this.resources.length = 0;
  }
}

function disposeScopes(scopes: readonly OwnedChunkRuntimeScope[]): void {
  for (let index = scopes.length - 1; index >= 0; index--) {
    scopes[index]?.dispose();
  }
}
