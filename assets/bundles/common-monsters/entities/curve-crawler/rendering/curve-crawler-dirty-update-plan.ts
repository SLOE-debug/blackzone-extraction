import { CurveCrawlerPackedMeshUpdate } from '../geometry/curve-crawler-packed-mesh-update';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { type CurveCrawlerColorSnapshot } from './curve-crawler-color-snapshot';
import { type CurveCrawlerResidentLayout } from './curve-crawler-resident-layout';

/**
 * 为共享动态网格生成单实体更新命令。
 *
 * 姿态脏实体更新位置；颜色量化输入发生变化的实体同时重算并上传颜色。
 */
export class CurveCrawlerDirtyUpdatePlan {
  public readonly updates: Uint8Array;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('Curve Crawler 脏区计划容量必须是正整数。');
    }
    this.updates = new Uint8Array(capacity);
  }

  /** 为当前紧凑布局写入无更新、位置更新或带颜色更新三种命令。 */
  public schedule(
    state: CurveCrawlerState,
    residents: CurveCrawlerResidentLayout,
    colors: CurveCrawlerColorSnapshot,
    poseDirty: boolean,
    force: boolean,
  ): void {
    for (let packedIndex = 0; packedIndex < residents.count; packedIndex++) {
      const entityIndex = residents.entityIndices[packedIndex];
      if (entityIndex === undefined || entityIndex >= state.count) {
        throw new Error('Curve Crawler 脏区计划包含越界实体。');
      }
      if (force || colors.didEntityChange(entityIndex)) {
        this.updates[packedIndex] = CurveCrawlerPackedMeshUpdate.Shaded;
      } else {
        this.updates[packedIndex] = poseDirty
          ? CurveCrawlerPackedMeshUpdate.Position
          : CurveCrawlerPackedMeshUpdate.None;
      }
    }
  }
}
