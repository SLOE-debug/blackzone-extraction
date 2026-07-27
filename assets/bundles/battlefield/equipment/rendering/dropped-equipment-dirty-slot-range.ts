/** 复用一个连续区间记录本帧真正重写的掉落槽位。 */
export class DroppedEquipmentDirtySlotRange {
  private firstSlotValue = Number.POSITIVE_INFINITY;
  private lastSlotValue = -1;

  public get dirty(): boolean {
    return this.lastSlotValue >= this.firstSlotValue;
  }

  public get firstSlot(): number {
    if (!this.dirty) {
      throw new Error('掉落装备脏槽位区间为空。');
    }
    return this.firstSlotValue;
  }

  public get lastSlot(): number {
    if (!this.dirty) {
      throw new Error('掉落装备脏槽位区间为空。');
    }
    return this.lastSlotValue;
  }

  public reset(): void {
    this.firstSlotValue = Number.POSITIVE_INFINITY;
    this.lastSlotValue = -1;
  }

  public include(slot: number): void {
    if (!Number.isSafeInteger(slot) || slot < 0) {
      throw new Error('掉落装备脏槽位必须是非负安全整数。');
    }
    this.firstSlotValue = Math.min(this.firstSlotValue, slot);
    this.lastSlotValue = Math.max(this.lastSlotValue, slot);
  }
}
