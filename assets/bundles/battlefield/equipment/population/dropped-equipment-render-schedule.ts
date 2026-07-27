/** 合并同一帧内多次掉落事务，只在统一更新末尾请求一次渲染刷新。 */
export class DroppedEquipmentRenderSchedule {
  private dirty = false;

  public markDirty(): void {
    this.dirty = true;
  }

  /** 消费事务脏标记；移动物品不依赖脏标记也会请求本帧刷新。 */
  public consumeFlushRequest(hasMovingItems: boolean): boolean {
    const requested = this.dirty || hasMovingItems;
    this.dirty = false;
    return requested;
  }
}
