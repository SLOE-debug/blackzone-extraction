import { describe, expect, it } from 'vitest';
import { type Disposable } from '../../assets/core/contracts/disposable';
import {
  ChunkRuntimeRegistry,
  type ChunkRuntimeParticipant,
} from '../../assets/core/world/chunk-runtime-registry';
import { ChunkWindowTracker } from '../../assets/core/world/chunk-window-tracker';

describe('Chunk 活动窗口', () => {
  it('只报告中心移动后真正新增和移除的边缘 Chunk', () => {
    const tracker = new ChunkWindowTracker(2);
    const initial = tracker.synchronize(0, 0);
    expect(initial.added).toHaveLength(25);
    expect(initial.removed).toHaveLength(0);

    const moved = tracker.synchronize(1, 0);
    expect(moved.added).toHaveLength(5);
    expect(moved.removed).toHaveLength(5);
    expect(moved.added.every((chunk) => chunk.x === 3)).toBe(true);
    expect(moved.removed.every((chunk) => chunk.x === -2)).toBe(true);
  });

  it('拒绝非整数中心和非法半径', () => {
    expect(() => new ChunkWindowTracker(-1)).toThrow(/非负/);
    expect(() => new ChunkWindowTracker(1).synchronize(0.5, 0)).toThrow(/安全整数/);
  });
});

describe('Chunk 运行时资源作用域', () => {
  it('卸载时释放该 Chunk 中所有参与者登记的对象且不影响保留 Chunk', () => {
    const events: string[] = [];
    const tracker = new ChunkWindowTracker(0);
    const registry = new ChunkRuntimeRegistry<string[]>();
    registry.register(createParticipant('怪物'));
    registry.register(createParticipant('宝箱'));

    registry.synchronize(tracker.synchronize(0, 0), events);
    registry.synchronize(tracker.synchronize(1, 0), events);

    expect(events).toEqual([
      '创建:怪物:0:0',
      '创建:宝箱:0:0',
      '创建:怪物:1:0',
      '创建:宝箱:1:0',
      '释放:宝箱:0:0',
      '释放:怪物:0:0',
    ]);

    registry.dispose();
    expect(events.slice(-2)).toEqual([
      '释放:宝箱:1:0',
      '释放:怪物:1:0',
    ]);
  });

  it('任一参与者创建失败时回滚该 Chunk 已经登记的资源', () => {
    const events: string[] = [];
    const registry = new ChunkRuntimeRegistry<string[]>();
    registry.register(createParticipant('怪物'));
    registry.register({
      populate(): void {
        throw new Error('宝箱创建失败');
      },
    });

    expect(() => registry.synchronize(
      new ChunkWindowTracker(0).synchronize(0, 0),
      events,
    )).toThrow(/宝箱创建失败/);
    expect(events).toEqual([
      '创建:怪物:0:0',
      '释放:怪物:0:0',
    ]);
    registry.dispose();
  });
});

function createParticipant(name: string): ChunkRuntimeParticipant<string[]> {
  return {
    populate(scope, events): void {
      const key = `${scope.chunk.x}:${scope.chunk.z}`;
      events.push(`创建:${name}:${key}`);
      scope.own(new RecordedDisposable(events, `释放:${name}:${key}`));
    },
  };
}

class RecordedDisposable implements Disposable {
  private disposed = false;

  constructor(
    private readonly events: string[],
    private readonly message: string,
  ) {}

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.events.push(this.message);
  }
}
