/** Venom Lobber 固定容量抛射物 SoA。 */
export class VenomBombState {
  public readonly active: Uint8Array;
  public readonly originX: Float32Array;
  public readonly originY: Float32Array;
  public readonly targetX: Float32Array;
  public readonly targetY: Float32Array;
  public readonly startElevation: Float32Array;
  public readonly arcHeight: Float32Array;
  public readonly elapsed: Float32Array;
  public readonly duration: Float32Array;

  constructor(public readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('毒弹容量必须是正整数。');
    }
    this.active = new Uint8Array(capacity);
    this.originX = new Float32Array(capacity);
    this.originY = new Float32Array(capacity);
    this.targetX = new Float32Array(capacity);
    this.targetY = new Float32Array(capacity);
    this.startElevation = new Float32Array(capacity);
    this.arcHeight = new Float32Array(capacity);
    this.elapsed = new Float32Array(capacity);
    this.duration = new Float32Array(capacity);
  }

  /** 占用一个空闲槽位；容量耗尽时拒绝本次技能而不覆盖在途毒弹。 */
  public spawn(
    originX: number,
    originY: number,
    targetX: number,
    targetY: number,
    startElevation: number,
    arcHeight: number,
    duration: number,
  ): boolean {
    if (!Number.isFinite(originX)
      || !Number.isFinite(originY)
      || !Number.isFinite(targetX)
      || !Number.isFinite(targetY)
      || !Number.isFinite(startElevation)
      || !Number.isFinite(arcHeight)
      || !Number.isFinite(duration)
      || startElevation <= 0
      || arcHeight <= 0
      || duration <= 0) {
      throw new Error('毒弹起点、目标和抛物线参数无效。');
    }
    for (let index = 0; index < this.capacity; index++) {
      if ((this.active[index] ?? 0) !== 0) {
        continue;
      }
      this.active[index] = 1;
      this.originX[index] = originX;
      this.originY[index] = originY;
      this.targetX[index] = targetX;
      this.targetY[index] = targetY;
      this.startElevation[index] = startElevation;
      this.arcHeight[index] = arcHeight;
      this.elapsed[index] = 0;
      this.duration[index] = duration;
      return true;
    }
    return false;
  }
}
