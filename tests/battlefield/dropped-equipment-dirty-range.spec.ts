import { describe, expect, it } from 'vitest';
import { DroppedEquipmentDirtySlotRange } from '../../assets/bundles/battlefield/equipment/rendering/dropped-equipment-dirty-slot-range';

describe('掉落装备脏槽位上传区间', () => {
  it('新增单件装备时只覆盖对应的一个槽位', () => {
    const range = new DroppedEquipmentDirtySlotRange();
    range.include(4);
    expect(range.firstSlot).toBe(4);
    expect(range.lastSlot).toBe(4);
  });

  it('删除中间槽位并用末尾回填时同时覆盖回填位与原末位', () => {
    const range = new DroppedEquipmentDirtySlotRange();
    range.include(1);
    range.include(4);
    expect(range.firstSlot).toBe(1);
    expect(range.lastSlot).toBe(4);
    range.reset();
    expect(range.dirty).toBe(false);
  });
});
