import { BATTLEFIELD_ARROW_CAPACITY } from './battlefield-arrow-population';

const TARGETS_PER_ARROW_SEQUENCE = 32;

/** 按箭槽和攻击序列复用的固定命中去重表。 */
export class BattlefieldArrowHitHistory {
  private readonly sequenceId = new Uint32Array(BATTLEFIELD_ARROW_CAPACITY);
  private readonly count = new Uint8Array(BATTLEFIELD_ARROW_CAPACITY);
  private readonly populationId = new Uint32Array(
    BATTLEFIELD_ARROW_CAPACITY * TARGETS_PER_ARROW_SEQUENCE,
  );
  private readonly entityId = new Uint32Array(
    BATTLEFIELD_ARROW_CAPACITY * TARGETS_PER_ARROW_SEQUENCE,
  );

  /** 首次命中返回 true；同一箭槽同一序列的重复目标返回 false。 */
  public accept(
    arrowIndex: number,
    sequenceId: number,
    populationId: number,
    entityId: number,
  ): boolean {
    if ((this.sequenceId[arrowIndex] ?? 0) !== sequenceId) {
      this.sequenceId[arrowIndex] = sequenceId;
      this.count[arrowIndex] = 0;
    }
    const start = arrowIndex * TARGETS_PER_ARROW_SEQUENCE;
    const count = this.count[arrowIndex] ?? 0;
    for (let index = 0; index < count; index++) {
      const offset = start + index;
      if ((this.populationId[offset] ?? 0) === populationId
        && (this.entityId[offset] ?? 0) === entityId) {
        return false;
      }
    }
    if (count >= TARGETS_PER_ARROW_SEQUENCE) {
      return false;
    }
    const offset = start + count;
    this.populationId[offset] = populationId;
    this.entityId[offset] = entityId;
    this.count[arrowIndex] = count + 1;
    return true;
  }

  public reset(): void {
    this.sequenceId.fill(0);
    this.count.fill(0);
  }
}
