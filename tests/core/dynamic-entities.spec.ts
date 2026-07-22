import { describe, expect, it } from 'vitest';
import { EntityChangeJournal } from '../../assets/core/rendering/dynamic-entities/entity-change-journal';
import { EntityRenderDirty } from '../../assets/core/rendering/dynamic-entities/entity-render-dirty';
import { EntityVisibilitySet } from '../../assets/core/rendering/dynamic-entities/entity-visibility-set';
import { StableRangeAllocator } from '../../assets/core/rendering/dynamic-entities/stable-range-allocator';
import { WorldPhase } from '../../assets/core/world/world-phase';
import { WorldScheduler } from '../../assets/core/world/world-scheduler';
import { type WorldSystem } from '../../assets/core/world/world-system';

describe('动态实体渲染基础设施', () => {
  it('复用已释放的稳定连续槽位并收缩尾部高水位', () => {
    const allocator = new StableRangeAllocator();
    expect(allocator.allocate(4)).toBe(0);
    expect(allocator.allocate(3)).toBe(4);
    allocator.release(0, 4);
    expect(allocator.allocate(2)).toBe(0);
    allocator.release(4, 3);
    expect(allocator.requiredCapacity).toBe(2);
  });

  it('只记录写入侧追加的变化并支持按属性消费', () => {
    const journal = new EntityChangeJournal(2);
    journal.mark(1, EntityRenderDirty.Position | EntityRenderDirty.Color);
    journal.clear(1, EntityRenderDirty.Position);
    expect(journal.read(1)).toBe(EntityRenderDirty.Color);
    expect(journal.hasAny(EntityRenderDirty.Color)).toBe(true);
  });

  it('维护无分配可见清单并标记集合变化', () => {
    const visibility = new EntityVisibilitySet(4);
    visibility.begin();
    visibility.include(1);
    visibility.include(3);
    expect(visibility.end()).toBe(true);
    expect(Array.from(visibility.entityIndices.subarray(0, visibility.count))).toEqual([1, 3]);
    expect(visibility.didEntityChange(1)).toBe(true);

    visibility.begin();
    visibility.include(1);
    visibility.include(3);
    expect(visibility.end()).toBe(false);
  });

});

describe('轻量 World Scheduler', () => {
  it('只在初始化排序，并按 Phase 与 Order 稳定推进系统', () => {
    const calls: number[] = [];
    const scheduler = new WorldScheduler<number[]>();
    scheduler.register(createRecordingSystem(WorldPhase.Combat, 20, 3));
    scheduler.register(createRecordingSystem(WorldPhase.Input, 10, 1));
    scheduler.register(createRecordingSystem(WorldPhase.Combat, 10, 2));
    scheduler.seal();
    scheduler.step(calls, 1 / 60);
    expect(calls).toEqual([1, 2, 3]);
  });
});

function createRecordingSystem(
  phase: WorldPhase,
  order: number,
  value: number,
): WorldSystem<number[]> {
  return {
    phase,
    order,
    update(world): void {
      world.push(value);
    },
  };
}
