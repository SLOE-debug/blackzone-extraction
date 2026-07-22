import {
  VENOM_LOBBER_DEATH_RESIDUE_SECONDS,
  VENOM_LOBBER_DEATH_SECONDS,
} from './venom-lobber-lifecycle';

/** Venom Lobber 死亡飞溅与残迹的固定容量装饰状态。 */
export class VenomDeathEffectState {
  public readonly active: Uint8Array;
  public readonly x: Float32Array;
  public readonly y: Float32Array;
  public readonly heading: Float32Array;
  public readonly scale: Float32Array;
  public readonly elapsed: Float32Array;
  public readonly duration: Float32Array;

  constructor(public readonly capacity: number) {
    this.active = new Uint8Array(capacity);
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.heading = new Float32Array(capacity);
    this.scale = new Float32Array(capacity);
    this.elapsed = new Float32Array(capacity);
    this.duration = new Float32Array(capacity);
  }

  public spawn(index: number, x: number, y: number, heading: number, scale: number): void {
    this.active[index] = 1;
    this.x[index] = x;
    this.y[index] = y;
    this.heading[index] = heading;
    this.scale[index] = scale;
    this.elapsed[index] = 0;
    this.duration[index] = VENOM_LOBBER_DEATH_SECONDS + VENOM_LOBBER_DEATH_RESIDUE_SECONDS;
  }

  public update(deltaTime: number): void {
    for (let index = 0; index < this.capacity; index++) {
      if ((this.active[index] ?? 0) === 0) {
        continue;
      }
      this.elapsed[index] = (this.elapsed[index] ?? 0) + deltaTime;
      if ((this.elapsed[index] ?? 0) >= (this.duration[index] ?? 0)) {
        this.active[index] = 0;
      }
    }
  }
}
