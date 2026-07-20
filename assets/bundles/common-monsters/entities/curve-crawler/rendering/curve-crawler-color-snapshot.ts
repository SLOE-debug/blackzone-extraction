import { type CurveCrawlerState } from '../model/curve-crawler-state';

/** 跟踪仅会触发顶点色变化的群体状态，避免普通姿态帧上传 Color。 */
export class CurveCrawlerColorSnapshot {
  private readonly hitFlashes: Float32Array;
  private readonly liquidDrains: Float32Array;
  private initialized = false;

  constructor(private readonly state: CurveCrawlerState) {
    this.hitFlashes = new Float32Array(state.count);
    this.liquidDrains = new Float32Array(state.count);
  }

  /** 保存当前颜色输入，并返回其是否相对上次采样发生变化。 */
  public capture(): boolean {
    const { hitFlash, liquidDrain } = this.state.data.animation;
    let changed = !this.initialized;
    for (let index = 0; index < this.state.count; index++) {
      const nextHitFlash = hitFlash[index] ?? 0;
      const nextLiquidDrain = liquidDrain[index] ?? 0;
      if (this.hitFlashes[index] !== nextHitFlash
        || this.liquidDrains[index] !== nextLiquidDrain) {
        changed = true;
      }
      this.hitFlashes[index] = nextHitFlash;
      this.liquidDrains[index] = nextLiquidDrain;
    }
    this.initialized = true;
    return changed;
  }
}
