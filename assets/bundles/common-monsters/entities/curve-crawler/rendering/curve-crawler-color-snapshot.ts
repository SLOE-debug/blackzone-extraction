import { type CurveCrawlerState } from '../model/curve-crawler-state';
import {
  quantizeCurveCrawlerHitFlash,
  quantizeCurveCrawlerLiquidDrain,
} from '../model/curve-crawler-color-signal';

/** 跟踪仅会触发顶点色变化的群体状态，避免普通姿态帧上传 Color。 */
export class CurveCrawlerColorSnapshot {
  private readonly hitFlashes: Float32Array;
  private readonly liquidDrains: Float32Array;
  private readonly initializedEntities: Uint8Array;

  constructor(private readonly state: CurveCrawlerState) {
    this.hitFlashes = new Float32Array(state.count);
    this.liquidDrains = new Float32Array(state.count);
    this.initializedEntities = new Uint8Array(state.count);
  }

  /** 比较并保存一个实体当前颜色量化输入。 */
  public captureEntityChange(entityIndex: number): boolean {
    if (!Number.isInteger(entityIndex)
      || entityIndex < 0
      || entityIndex >= this.state.count) {
      throw new Error('Curve Crawler 颜色快照实体槽位越界。');
    }
    const { hitFlash, liquidDrain } = this.state.data.animation;
    const nextHitFlash = quantizeCurveCrawlerHitFlash(hitFlash[entityIndex] ?? 0);
    const nextLiquidDrain = quantizeCurveCrawlerLiquidDrain(
      liquidDrain[entityIndex] ?? 0,
    );
    const changed = (this.initializedEntities[entityIndex] ?? 0) === 0
      || this.hitFlashes[entityIndex] !== nextHitFlash
      || this.liquidDrains[entityIndex] !== nextLiquidDrain;
    this.hitFlashes[entityIndex] = nextHitFlash;
    this.liquidDrains[entityIndex] = nextLiquidDrain;
    this.initializedEntities[entityIndex] = 1;
    return changed;
  }

  /** 保存独占渲染器使用的完整群体颜色输入快照。 */
  public capture(): boolean {
    let changed = false;
    for (let entityIndex = 0; entityIndex < this.state.count; entityIndex++) {
      changed = this.captureEntityChange(entityIndex) || changed;
    }
    return changed;
  }
}
