/**
 * 保存固定容量实体的当前可见清单和相对上一帧的变化位。
 *
 * 领域适配器负责执行具体相交测试，本类只维护无分配的集合状态。
 */
export class EntityVisibilitySet {
  public readonly entityIndices: Uint32Array;
  private readonly visibleEntities: Uint8Array;
  private readonly nextVisibleEntities: Uint8Array;
  private readonly changedEntities: Uint8Array;
  private visibleCount = 0;
  private nextVisibleCount = 0;
  private collecting = false;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('实体可见集合容量必须是正整数。');
    }
    this.entityIndices = new Uint32Array(capacity);
    this.visibleEntities = new Uint8Array(capacity);
    this.nextVisibleEntities = new Uint8Array(capacity);
    this.changedEntities = new Uint8Array(capacity);
  }

  /** 当前可见实体数量。 */
  public get count(): number {
    return this.visibleCount;
  }

  /** 开始收集下一帧可见实体。 */
  public begin(): void {
    if (this.collecting) {
      throw new Error('实体可见集合已经开始收集。');
    }
    this.collecting = true;
    this.nextVisibleCount = 0;
    this.nextVisibleEntities.fill(0);
    this.changedEntities.fill(0);
  }

  /** 按稳定实体索引升序加入一个通过领域可见性测试的实体。 */
  public include(entityIndex: number): void {
    if (!this.collecting) {
      throw new Error('实体可见集合尚未开始收集。');
    }
    if (!Number.isInteger(entityIndex)
      || entityIndex < 0
      || entityIndex >= this.entityIndices.length
      || (this.nextVisibleEntities[entityIndex] ?? 0) !== 0) {
      throw new Error('实体可见集合包含无效或重复槽位。');
    }
    const previousEntity = this.nextVisibleCount > 0
      ? this.entityIndices[this.nextVisibleCount - 1]
      : undefined;
    if (previousEntity !== undefined && entityIndex <= previousEntity) {
      throw new Error('实体可见集合必须按稳定槽位升序写入。');
    }
    this.nextVisibleEntities[entityIndex] = 1;
    this.entityIndices[this.nextVisibleCount++] = entityIndex;
  }

  /** 完成收集、计算变化位并返回集合是否变化。 */
  public end(): boolean {
    if (!this.collecting) {
      throw new Error('实体可见集合尚未开始收集。');
    }
    this.collecting = false;
    const nextCount = this.nextVisibleCount;
    let changed = nextCount !== this.visibleCount;
    for (let entityIndex = 0; entityIndex < this.entityIndices.length; entityIndex++) {
      if ((this.nextVisibleEntities[entityIndex] ?? 0)
        === (this.visibleEntities[entityIndex] ?? 0)) {
        continue;
      }
      this.changedEntities[entityIndex] = 1;
      changed = true;
    }
    this.visibleEntities.set(this.nextVisibleEntities);
    this.visibleCount = nextCount;
    return changed;
  }

  /** 返回实体本帧是否进入或离开可见集合。 */
  public didEntityChange(entityIndex: number): boolean {
    return (this.changedEntities[entityIndex] ?? 0) !== 0;
  }

}
