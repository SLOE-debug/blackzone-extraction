import {
  type BattlefieldMeleeHitBuffer,
  type BattlefieldMeleeSweepQuery,
} from '../../combat/melee/battlefield-melee-query';

const MAXIMUM_DEBUG_HITS = 64;

/** Debug 面板读取的锤头胶囊与命中目标快照。 */
export interface BattlefieldHammerSweepDebugSource {
  readonly enabled: boolean;
  readonly active: boolean;
  readonly startX: number;
  readonly startZ: number;
  readonly endX: number;
  readonly endZ: number;
  readonly radius: number;
  readonly hitCount: number;
  setEnabled(enabled: boolean): void;
  getHitX(index: number): number;
  getHitZ(index: number): number;
}

/** 保存最近一帧实际提交的锤头扫掠，正式战斗关闭时不复制命中数据。 */
export class BattlefieldHammerSweepDebugState implements BattlefieldHammerSweepDebugSource {
  public enabled = false;
  public active = false;
  public startX = 0;
  public startZ = 0;
  public endX = 0;
  public endZ = 0;
  public radius = 0;
  public hitCount = 0;
  private candidateCount = 0;
  private readonly candidatePopulationId = new Uint32Array(MAXIMUM_DEBUG_HITS);
  private readonly candidateEntityId = new Uint32Array(MAXIMUM_DEBUG_HITS);
  private readonly candidateX = new Float32Array(MAXIMUM_DEBUG_HITS);
  private readonly candidateZ = new Float32Array(MAXIMUM_DEBUG_HITS);
  private readonly hitX = new Float32Array(MAXIMUM_DEBUG_HITS);
  private readonly hitZ = new Float32Array(MAXIMUM_DEBUG_HITS);

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.resetFrame();
    }
  }

  public beginFrame(): void {
    this.resetFrame();
  }

  /** 记录战斗层实际使用的胶囊参数与待结算窄相位候选。 */
  public record(
    query: Readonly<BattlefieldMeleeSweepQuery>,
    hits: BattlefieldMeleeHitBuffer,
    hitCount: number,
  ): void {
    if (!this.enabled) {
      return;
    }
    if (!this.active) {
      this.active = true;
      this.startX = query.startX;
      this.startZ = query.startZ;
      this.radius = query.radius;
    }
    this.endX = query.endX;
    this.endZ = query.endZ;
    const writableCount = Math.min(hitCount, MAXIMUM_DEBUG_HITS - this.candidateCount);
    for (let index = 0; index < writableCount; index++) {
      const target = this.candidateCount++;
      this.candidatePopulationId[target] = hits.populationIds[index] ?? 0;
      this.candidateEntityId[target] = hits.entityIds[index] ?? 0;
      this.candidateX[target] = hits.positionX[index] ?? 0;
      this.candidateZ[target] = hits.positionZ[index] ?? 0;
    }
  }

  /** 只把通过攻击序列去重并真正进入结算的目标标记为命中。 */
  public confirmHit(populationId: number, entityId: number): void {
    if (!this.enabled || !this.active || this.hitCount >= MAXIMUM_DEBUG_HITS) {
      return;
    }
    for (let index = 0; index < this.candidateCount; index++) {
      if ((this.candidatePopulationId[index] ?? 0) !== populationId
        || (this.candidateEntityId[index] ?? 0) !== entityId) {
        continue;
      }
      this.hitX[this.hitCount] = this.candidateX[index] ?? 0;
      this.hitZ[this.hitCount] = this.candidateZ[index] ?? 0;
      this.hitCount++;
      return;
    }
  }

  public getHitX(index: number): number {
    return index >= 0 && index < this.hitCount ? this.hitX[index] ?? 0 : 0;
  }

  public getHitZ(index: number): number {
    return index >= 0 && index < this.hitCount ? this.hitZ[index] ?? 0 : 0;
  }

  public reset(): void {
    this.resetFrame();
  }

  private resetFrame(): void {
    this.active = false;
    this.candidateCount = 0;
    this.hitCount = 0;
  }
}
