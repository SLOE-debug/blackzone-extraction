import { describe, expect, it } from 'vitest';
import { DroppedEquipmentRenderSchedule } from '../../assets/bundles/battlefield/equipment/population/dropped-equipment-render-schedule';

describe('掉落装备帧尾渲染调度', () => {
  it('同一帧多次事务标脏只产生一次刷新请求', () => {
    const schedule = new DroppedEquipmentRenderSchedule();
    schedule.markDirty();
    schedule.markDirty();
    schedule.markDirty();
    expect(schedule.consumeFlushRequest(false)).toBe(true);
    expect(schedule.consumeFlushRequest(false)).toBe(false);
  });

  it('移动物品每帧刷新但不会遗留下一帧脏状态', () => {
    const schedule = new DroppedEquipmentRenderSchedule();
    expect(schedule.consumeFlushRequest(true)).toBe(true);
    expect(schedule.consumeFlushRequest(false)).toBe(false);
  });
});
