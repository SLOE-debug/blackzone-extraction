import { type CurveCrawlerState } from '../model/curve-crawler-state';
import {
  quantizeCurveCrawlerHitFlash,
  quantizeCurveCrawlerLiquidDrain,
} from '../model/curve-crawler-color-signal';

/** 跟踪仅会触发顶点色变化的群体状态，避免普通姿态帧上传 Color。 */
export class CurveCrawlerColorSnapshot {
  private readonly hitFlashes: Float32Array;
  private readonly liquidDrains: Float32Array;
  private readonly changedEntities: Uint8Array;
  private initialized = false;

  constructor(private readonly state: CurveCrawlerState) {
    this.hitFlashes = new Float32Array(state.count);
    this.liquidDrains = new Float32Array(state.count);
    this.changedEntities = new Uint8Array(state.count);
  }

  /** 返回指定源实体在本帧采样中是否跨过了一个可见颜色档位。 */
  public didEntityChange(entityIndex: number): boolean {
    return (this.changedEntities[entityIndex] ?? 0) !== 0;
  }

  /** 保存当前颜色输入，并返回其是否相对上次采样发生变化。 */
  public capture(): boolean {
    const { hitFlash, liquidDrain } = this.state.data.animation;
    this.changedEntities.fill(0);
    let changed = !this.initialized;
    for (let index = 0; index < this.state.count; index++) {
      const nextHitFlash = quantizeCurveCrawlerHitFlash(hitFlash[index] ?? 0);
      const nextLiquidDrain = quantizeCurveCrawlerLiquidDrain(liquidDrain[index] ?? 0);
      if (this.hitFlashes[index] !== nextHitFlash
        || this.liquidDrains[index] !== nextLiquidDrain) {
        changed = true;
        this.changedEntities[index] = 1;
      }
      this.hitFlashes[index] = nextHitFlash;
      this.liquidDrains[index] = nextLiquidDrain;
    }
    this.initialized = true;
    return changed;
  }

  /** 只比较紧凑渲染布局中的真实驻留槽位。 */
  public captureResident(entityIndices: Uint32Array, entityCount: number): boolean {
    if (!Number.isInteger(entityCount)
      || entityCount < 0
      || entityCount > entityIndices.length) {
      throw new Error('Curve Crawler 颜色快照的驻留范围无效。');
    }
    const { hitFlash, liquidDrain } = this.state.data.animation;
    this.changedEntities.fill(0);
    let changed = !this.initialized;
    for (let packedIndex = 0; packedIndex < entityCount; packedIndex++) {
      const entityIndex = entityIndices[packedIndex];
      if (entityIndex === undefined || entityIndex >= this.state.count) {
        throw new Error('Curve Crawler 颜色快照包含越界实体槽位。');
      }
      const nextHitFlash = quantizeCurveCrawlerHitFlash(hitFlash[entityIndex] ?? 0);
      const nextLiquidDrain = quantizeCurveCrawlerLiquidDrain(
        liquidDrain[entityIndex] ?? 0,
      );
      if (this.hitFlashes[entityIndex] !== nextHitFlash
        || this.liquidDrains[entityIndex] !== nextLiquidDrain) {
        changed = true;
        this.changedEntities[entityIndex] = 1;
      }
      this.hitFlashes[entityIndex] = nextHitFlash;
      this.liquidDrains[entityIndex] = nextLiquidDrain;
    }
    this.initialized = true;
    return changed;
  }
}
