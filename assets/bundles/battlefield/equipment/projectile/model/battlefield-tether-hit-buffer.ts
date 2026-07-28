/** 弦网重叠查询使用的固定容量无序命中缓冲。 */
export class BattlefieldTetherHitBuffer {
  public readonly populationId: Uint32Array;
  public readonly entityId: Uint32Array;
  public readonly x: Float32Array;
  public readonly z: Float32Array;
  private hitCount = 0;

  constructor(public readonly capacity = 512) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new Error('弦网命中缓冲容量必须为正安全整数。');
    }
    this.populationId = new Uint32Array(capacity);
    this.entityId = new Uint32Array(capacity);
    this.x = new Float32Array(capacity);
    this.z = new Float32Array(capacity);
  }

  public get count(): number {
    return this.hitCount;
  }

  public reset(): void {
    this.hitCount = 0;
  }

  /** 以 O(1) 复杂度追加重叠目标，不为无顺序语义的弦网执行插入排序。 */
  public include(
    populationId: number,
    entityId: number,
    x: number,
    z: number,
  ): void {
    if (this.hitCount >= this.capacity) {
      throw new Error('弦网命中缓冲容量不足。');
    }
    const index = this.hitCount++;
    this.populationId[index] = populationId;
    this.entityId[index] = entityId;
    this.x[index] = x;
    this.z[index] = z;
  }
}
