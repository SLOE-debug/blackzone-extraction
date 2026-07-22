/** 固定容量保存一帧内全部实体弹丸命中，延迟到 PostSimulation 统一结算。 */
export class BattlefieldProjectileImpactBuffer {
  public readonly populationIds: Uint32Array;
  public readonly entityIds: Uint32Array;
  public readonly damage: Float32Array;
  private impactCount = 0;

  constructor(public readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new Error('弹丸命中缓冲容量必须是正整数。');
    }
    this.populationIds = new Uint32Array(capacity);
    this.entityIds = new Uint32Array(capacity);
    this.damage = new Float32Array(capacity);
  }

  public get count(): number {
    return this.impactCount;
  }

  /** 开始新的碰撞帧，旧命中必须已经完成结算。 */
  public reset(): void {
    this.impactCount = 0;
  }

  /** 按弹丸与 TOI 顺序追加一个确定命中。 */
  public include(populationId: number, entityId: number, damage: number): void {
    if (this.impactCount >= this.capacity) {
      throw new Error('弹丸命中缓冲容量与弹丸穿透上限不一致。');
    }
    if (!Number.isSafeInteger(populationId) || populationId < 0
      || !Number.isSafeInteger(entityId) || entityId < 0
      || !Number.isFinite(damage) || damage <= 0) {
      throw new Error('弹丸命中事件包含无效的实体标识或伤害。');
    }
    const index = this.impactCount++;
    this.populationIds[index] = populationId;
    this.entityIds[index] = entityId;
    this.damage[index] = damage;
  }
}
