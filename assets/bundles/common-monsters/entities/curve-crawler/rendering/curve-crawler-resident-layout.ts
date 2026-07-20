import {
  isMonsterLifecycleResident,
  type MonsterLifecycleState,
} from '../../../../../core/contracts/monster-lifecycle';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

/**
 * 维护当前仍具有可见生命周期的 Curve Crawler 槽位紧凑清单。
 *
 * 清单使用固定 TypedArray，并在每帧原地同步；休眠与死亡完成槽位不会进入动态网格。
 */
export class CurveCrawlerResidentLayout {
  public readonly entityIndices: Uint32Array;
  private residentCount = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('Curve Crawler 驻留布局容量必须是正整数。');
    }
    this.entityIndices = new Uint32Array(capacity);
  }

  /** 当前需要进入渲染批次的实体数量。 */
  public get count(): number {
    return this.residentCount;
  }

  /**
   * 从 SoA 生命周期流重建紧凑槽位清单。
   *
   * @returns 槽位数量或顺序是否相对上一次同步发生变化。
   */
  public synchronize(state: CurveCrawlerState): boolean {
    if (state.count !== this.entityIndices.length) {
      throw new Error('Curve Crawler 驻留布局与实体表容量不一致。');
    }
    const lifecycle = state.data.vitality.state;
    let nextCount = 0;
    let changed = false;
    for (let entityIndex = 0; entityIndex < state.count; entityIndex++) {
      if (!isMonsterLifecycleResident(
        lifecycle[entityIndex] as MonsterLifecycleState,
      )) {
        continue;
      }
      if ((this.entityIndices[nextCount] ?? 0) !== entityIndex) {
        changed = true;
      }
      this.entityIndices[nextCount] = entityIndex;
      nextCount++;
    }
    if (nextCount !== this.residentCount) {
      changed = true;
    }
    this.residentCount = nextCount;
    return changed;
  }
}
