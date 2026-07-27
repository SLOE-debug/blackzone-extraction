/** 近战扇形或整圆查询的世界空间参数。 */
export interface BattlefieldMeleeQuery {
  readonly originX: number;
  readonly originZ: number;
  readonly directionX: number;
  readonly directionZ: number;
  readonly reach: number;
  readonly arcRadians: number;
}

/** 真实锤头连续两帧之间的世界空间 Swept Capsule 查询。 */
export interface BattlefieldMeleeSweepQuery {
  readonly startX: number;
  readonly startZ: number;
  readonly endX: number;
  readonly endZ: number;
  readonly radius: number;
}

/** 预分配的近战命中结果，避免攻击热路径创建对象。 */
export class BattlefieldMeleeHitBuffer {
  public readonly populationIds: Uint32Array;
  public readonly entityIds: Uint32Array;
  public readonly positionX: Float32Array;
  public readonly positionZ: Float32Array;
  private hitCount = 0;

  constructor(public readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new Error('近战命中缓冲容量必须为正安全整数。');
    }
    this.populationIds = new Uint32Array(capacity);
    this.entityIds = new Uint32Array(capacity);
    this.positionX = new Float32Array(capacity);
    this.positionZ = new Float32Array(capacity);
  }

  public get count(): number {
    return this.hitCount;
  }

  public reset(): void {
    this.hitCount = 0;
  }

  public include(
    populationId: number,
    entityId: number,
    positionX: number,
    positionZ: number,
  ): void {
    if (this.hitCount >= this.capacity) {
      throw new Error('近战命中缓冲容量不足。');
    }
    const index = this.hitCount++;
    this.populationIds[index] = populationId;
    this.entityIds[index] = entityId;
    this.positionX[index] = positionX;
    this.positionZ[index] = positionZ;
  }
}
