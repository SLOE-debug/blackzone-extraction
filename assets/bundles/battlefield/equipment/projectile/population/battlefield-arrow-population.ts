import {
  BattlefieldArrowRecallKind,
  BattlefieldArrowState,
} from '../model/battlefield-arrow-state';

export const BATTLEFIELD_PERMANENT_ARROW_CAPACITY = 6;
export const BATTLEFIELD_TEMPORARY_ARROW_CAPACITY = 18;
export const BATTLEFIELD_ARROW_CAPACITY = 24;

/** 六支永久箭与临时子箭共享的固定容量 SoA。 */
export class BattlefieldArrowPopulation {
  public readonly active = new Uint8Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly permanent = new Uint8Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly state = new Uint8Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly ownerEntityId = new Uint32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly arrowSlot = new Uint8Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly positionX = new Float32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly positionY = new Float32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly positionZ = new Float32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly previousX = new Float32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly previousY = new Float32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly previousZ = new Float32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly directionX = new Float32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly directionY = new Float32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly directionZ = new Float32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly damage = new Float32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly speed = new Float32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly remainingRange = new Float32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly pierceRemaining = new Uint8Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly attachedPopulationId = new Uint32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly attachedEntityId = new Uint32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly attachmentOffsetX = new Float32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly attachmentOffsetY = new Float32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly attachmentOffsetZ = new Float32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly attackSequenceId = new Uint32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly skillSequenceId = new Uint32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly moduleMask = new Uint32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly departureOrder = new Uint32Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly recallKind = new Uint8Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly recallLateralSign = new Int8Array(BATTLEFIELD_ARROW_CAPACITY);
  public readonly dirty = new Uint8Array(BATTLEFIELD_ARROW_CAPACITY);
  private departureSequence = 0;

  constructor(ownerEntityId = 0) {
    this.reset(ownerEntityId);
  }

  /** 把永久箭恢复到箭袋，临时槽位全部释放。 */
  public reset(ownerEntityId = 0): void {
    this.active.fill(0);
    this.permanent.fill(0);
    this.state.fill(BattlefieldArrowState.Ready);
    this.recallKind.fill(BattlefieldArrowRecallKind.None);
    this.moduleMask.fill(0);
    for (let index = 0; index < BATTLEFIELD_PERMANENT_ARROW_CAPACITY; index++) {
      this.active[index] = 1;
      this.permanent[index] = 1;
      this.ownerEntityId[index] = ownerEntityId;
      this.arrowSlot[index] = index;
      this.recallLateralSign[index] = index % 2 === 0 ? -1 : 1;
      this.dirty[index] = 1;
    }
    this.departureSequence = 0;
  }

  public get readyCount(): number {
    let count = 0;
    for (let index = 0; index < BATTLEFIELD_PERMANENT_ARROW_CAPACITY; index++) {
      count += Number(this.state[index] === BattlefieldArrowState.Ready);
    }
    return count;
  }

  public findReadyArrow(): number {
    for (let index = 0; index < BATTLEFIELD_PERMANENT_ARROW_CAPACITY; index++) {
      if (this.state[index] === BattlefieldArrowState.Ready) {
        return index;
      }
    }
    return -1;
  }

  /** 返回最早离开箭袋且尚未回程的永久箭。 */
  public findOldestRecallableArrow(): number {
    let best = -1;
    let bestOrder = Number.POSITIVE_INFINITY;
    for (let index = 0; index < BATTLEFIELD_PERMANENT_ARROW_CAPACITY; index++) {
      const state = this.state[index] as BattlefieldArrowState;
      const order = this.departureOrder[index] ?? 0;
      if (state !== BattlefieldArrowState.Ready
        && state !== BattlefieldArrowState.Drawing
        && state !== BattlefieldArrowState.Returning
        && order > 0
        && order < bestOrder) {
        best = index;
        bestOrder = order;
      }
    }
    return best;
  }

  public markDeparted(index: number): void {
    this.assertPermanent(index);
    this.departureSequence = this.departureSequence >= 0xffffffff ? 1 : this.departureSequence + 1;
    this.departureOrder[index] = this.departureSequence;
    this.dirty[index] = 1;
  }

  public restoreReady(index: number): void {
    this.assertPermanent(index);
    this.state[index] = BattlefieldArrowState.Ready;
    this.recallKind[index] = BattlefieldArrowRecallKind.None;
    this.attackSequenceId[index] = 0;
    this.skillSequenceId[index] = 0;
    this.departureOrder[index] = 0;
    this.attachedPopulationId[index] = 0;
    this.attachedEntityId[index] = 0;
    this.dirty[index] = 1;
  }

  public countState(state: BattlefieldArrowState): number {
    let count = 0;
    for (let index = 0; index < BATTLEFIELD_PERMANENT_ARROW_CAPACITY; index++) {
      count += Number(this.state[index] === state);
    }
    return count;
  }

  private assertPermanent(index: number): void {
    if (!Number.isSafeInteger(index) || index < 0
      || index >= BATTLEFIELD_PERMANENT_ARROW_CAPACITY) {
      throw new Error('永久箭索引越界。');
    }
  }
}
