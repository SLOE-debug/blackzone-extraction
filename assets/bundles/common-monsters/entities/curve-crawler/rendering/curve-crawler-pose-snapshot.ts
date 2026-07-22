import { CURVE_CRAWLER_FRAGMENT_COUNT } from '../model/curve-crawler-schema';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

const HASH_OFFSET_BASIS = 0x811c9dc5;
const HASH_PRIME = 0x01000193;

/** 跟踪逐实体程序化几何输入，避免没有可见姿态变化的实体重复求值。 */
export class CurveCrawlerPoseSnapshot {
  private readonly hashes: Uint32Array;
  private readonly initialized: Uint8Array;
  private readonly floatScratch = new Float32Array(1);
  private readonly integerScratch = new Uint32Array(this.floatScratch.buffer);

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('Curve Crawler 姿态快照容量必须是正整数。');
    }
    this.hashes = new Uint32Array(capacity);
    this.initialized = new Uint8Array(capacity);
  }

  /** 比较并保存一个实体当前所有动态几何输入。 */
  public captureEntityChange(state: CurveCrawlerState, entityIndex: number): boolean {
    if (!Number.isInteger(entityIndex) || entityIndex < 0 || entityIndex >= state.count) {
      throw new Error('Curve Crawler 姿态快照实体槽位越界。');
    }
    const hash = this.hashEntityPose(state, entityIndex);
    const changed = (this.initialized[entityIndex] ?? 0) === 0
      || (this.hashes[entityIndex] ?? 0) !== hash;
    this.hashes[entityIndex] = hash;
    this.initialized[entityIndex] = 1;
    return changed;
  }

  private hashEntityPose(state: CurveCrawlerState, entityIndex: number): number {
    const { transform, vitality, animation } = state.data;
    let hash = this.mixInteger(HASH_OFFSET_BASIS, vitality.state[entityIndex] ?? 0);
    hash = this.mixFloat(hash, transform.x[entityIndex] ?? 0);
    hash = this.mixFloat(hash, transform.y[entityIndex] ?? 0);
    hash = this.mixFloat(hash, transform.heading[entityIndex] ?? 0);
    hash = this.mixFloat(hash, transform.headingCosine[entityIndex] ?? 1);
    hash = this.mixFloat(hash, transform.headingSine[entityIndex] ?? 0);
    hash = this.mixFloat(hash, animation.phase[entityIndex] ?? 0);
    hash = this.mixFloat(hash, animation.bodyPulse[entityIndex] ?? 0);
    hash = this.mixFloat(hash, animation.crouchAmount[entityIndex] ?? 0);
    hash = this.mixFloat(hash, animation.biteAmount[entityIndex] ?? 0);
    hash = this.mixFloat(hash, animation.turnAmount[entityIndex] ?? 0);
    hash = this.mixFloat(hash, animation.turnDirection[entityIndex] ?? 1);
    hash = this.mixFloat(hash, animation.blinkScale[entityIndex] ?? 1);
    hash = this.mixFloat(hash, animation.crackSpread[entityIndex] ?? 0);
    hash = this.mixFloat(hash, animation.crackVisibility[entityIndex] ?? 0);
    hash = this.mixFloat(hash, animation.eggScale[entityIndex] ?? 0);
    hash = this.mixFloat(hash, animation.eggBulge[entityIndex] ?? 0);
    hash = this.mixFloat(hash, animation.eggBurst[entityIndex] ?? 0);
    hash = this.mixFloat(hash, animation.emergenceBodyScale[entityIndex] ?? 0);
    hash = this.mixFloat(hash, animation.emergenceLegScale[entityIndex] ?? 0);
    hash = this.mixFloat(hash, animation.surfaceCollapse[entityIndex] ?? 0);
    hash = this.mixFloat(hash, animation.liquidSpread[entityIndex] ?? 0);
    hash = this.mixFloat(hash, animation.liquidDrain[entityIndex] ?? 0);

    const fragmentOffset = entityIndex * CURVE_CRAWLER_FRAGMENT_COUNT;
    const fragmentEnd = fragmentOffset + CURVE_CRAWLER_FRAGMENT_COUNT;
    for (let fragment = fragmentOffset; fragment < fragmentEnd; fragment++) {
      hash = this.mixFloat(hash, animation.fragmentOffsetX[fragment] ?? 0);
      hash = this.mixFloat(hash, animation.fragmentOffsetY[fragment] ?? 0);
      hash = this.mixFloat(hash, animation.fragmentOffsetZ[fragment] ?? 0);
      hash = this.mixFloat(hash, animation.fragmentRotation[fragment] ?? 0);
    }
    return hash >>> 0;
  }

  private mixFloat(hash: number, value: number): number {
    this.floatScratch[0] = value;
    return this.mixInteger(hash, this.integerScratch[0] ?? 0);
  }

  private mixInteger(hash: number, value: number): number {
    return Math.imul((hash ^ value) >>> 0, HASH_PRIME) >>> 0;
  }
}
