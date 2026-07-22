/** 毒弹落地后形成的固定容量酸池 SoA。 */
export class VenomPoolState {
  public readonly active: Uint8Array;
  public readonly x: Float32Array;
  public readonly y: Float32Array;
  public readonly radius: Float32Array;
  public readonly elapsed: Float32Array;
  public readonly duration: Float32Array;
  public readonly catalyzed: Uint8Array;

  constructor(public readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('酸池容量必须是正整数。');
    }
    this.active = new Uint8Array(capacity);
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.radius = new Float32Array(capacity);
    this.elapsed = new Float32Array(capacity);
    this.duration = new Float32Array(capacity);
    this.catalyzed = new Uint8Array(capacity);
  }

  /** 写入空闲槽位；全部占用时替换剩余时间最短的旧酸池。 */
  public spawn(
    x: number,
    y: number,
    radius: number,
    duration: number,
    catalyzed: boolean,
  ): void {
    if (!Number.isFinite(x)
      || !Number.isFinite(y)
      || !Number.isFinite(radius)
      || !Number.isFinite(duration)
      || radius <= 0
      || duration <= 0) {
      throw new Error('酸池位置、半径与持续时间无效。');
    }
    let targetIndex = -1;
    let leastRemaining = Number.POSITIVE_INFINITY;
    for (let index = 0; index < this.capacity; index++) {
      if ((this.active[index] ?? 0) === 0) {
        targetIndex = index;
        break;
      }
      const remaining = (this.duration[index] ?? 0) - (this.elapsed[index] ?? 0);
      if (remaining < leastRemaining) {
        leastRemaining = remaining;
        targetIndex = index;
      }
    }
    if (targetIndex < 0) {
      throw new Error('酸池状态没有可用槽位。');
    }
    this.active[targetIndex] = 1;
    this.x[targetIndex] = x;
    this.y[targetIndex] = y;
    this.radius[targetIndex] = radius;
    this.elapsed[targetIndex] = 0;
    this.duration[targetIndex] = duration;
    this.catalyzed[targetIndex] = catalyzed ? 1 : 0;
  }
}
