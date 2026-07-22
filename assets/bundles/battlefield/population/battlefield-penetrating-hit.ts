/** 一次 Hitscan 贯穿查询的世界空间参数。 */
export interface BattlefieldPenetratingHitQuery {
  readonly startX: number;
  readonly startY: number;
  readonly startZ: number;
  readonly endX: number;
  readonly endY: number;
  readonly endZ: number;
  readonly impactRadius: number;
  readonly damage: number;
  readonly maximumHitCount: number;
  readonly damageRetention: number;
}

/** 按线段进度排序并去重的固定容量 Hitscan 命中缓冲。 */
export class BattlefieldPenetratingHitBuffer {
  public readonly populationIds: Uint32Array;
  public readonly entityIds: Uint32Array;
  public readonly x: Float32Array;
  public readonly y: Float32Array;
  public readonly z: Float32Array;
  public readonly segmentProgress: Float32Array;
  private hitCount = 0;

  constructor(public readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new Error('贯穿命中缓冲容量必须是正整数。');
    }
    this.populationIds = new Uint32Array(capacity);
    this.entityIds = new Uint32Array(capacity);
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.z = new Float32Array(capacity);
    this.segmentProgress = new Float32Array(capacity);
  }

  public get count(): number {
    return this.hitCount;
  }

  public reset(): void {
    this.hitCount = 0;
  }

  /** 按进度插入；同一群体实体只保留最近交点，满载时丢弃更远结果。 */
  public include(
    populationId: number,
    entityId: number,
    x: number,
    y: number,
    z: number,
    progress: number,
  ): void {
    for (let index = 0; index < this.hitCount; index++) {
      if ((this.populationIds[index] ?? 0) === populationId
        && (this.entityIds[index] ?? 0) === entityId) {
        return;
      }
    }
    let insertion = this.hitCount;
    while (insertion > 0
      && (this.segmentProgress[insertion - 1] ?? 0) > progress) {
      insertion--;
    }
    if (insertion >= this.capacity) {
      return;
    }
    const nextCount = Math.min(this.hitCount + 1, this.capacity);
    for (let index = nextCount - 1; index > insertion; index--) {
      this.populationIds[index] = this.populationIds[index - 1] ?? 0;
      this.entityIds[index] = this.entityIds[index - 1] ?? 0;
      this.x[index] = this.x[index - 1] ?? 0;
      this.y[index] = this.y[index - 1] ?? 0;
      this.z[index] = this.z[index - 1] ?? 0;
      this.segmentProgress[index] = this.segmentProgress[index - 1] ?? 0;
    }
    this.populationIds[insertion] = populationId;
    this.entityIds[insertion] = entityId;
    this.x[insertion] = x;
    this.y[insertion] = y;
    this.z[insertion] = z;
    this.segmentProgress[insertion] = progress;
    this.hitCount = nextCount;
  }
}

/** 校验武器侧贯穿参数，避免伤害衰减或固定缓冲出现非法状态。 */
export function validateBattlefieldPenetratingHitQuery(
  query: Readonly<BattlefieldPenetratingHitQuery>,
  bufferCapacity: number,
): void {
  if (![query.startX, query.startY, query.startZ, query.endX, query.endY, query.endZ,
    query.impactRadius, query.damage, query.damageRetention].every(Number.isFinite)
    || query.impactRadius < 0
    || query.damage <= 0
    || !Number.isSafeInteger(query.maximumHitCount)
    || query.maximumHitCount <= 0
    || query.maximumHitCount > bufferCapacity
    || query.damageRetention <= 0
    || query.damageRetention > 1) {
    throw new Error('战场贯穿命中参数无效。');
  }
  const deltaX = query.endX - query.startX;
  const deltaY = query.endY - query.startY;
  const deltaZ = query.endZ - query.startZ;
  if (deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ <= 0.000001) {
    throw new Error('战场贯穿命中线段不能退化。');
  }
}
