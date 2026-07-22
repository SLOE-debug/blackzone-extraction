import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { PlanarVisibilityDetail } from '../../../../../core/contracts/planar-circle-visibility';
import { CurveCrawlerPackedMeshUpdate } from '../geometry/curve-crawler-packed-mesh-update';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { type CurveCrawlerColorSnapshot } from './curve-crawler-color-snapshot';
import { type CurveCrawlerResidentLayout } from './curve-crawler-resident-layout';

const REDUCED_UPDATE_DIVISOR = 2;
const MINIMAL_UPDATE_DIVISOR = 4;

/**
 * 把远距存活蜘蛛的 CPU 姿态求值错峰到不同帧。
 *
 * 近距、出生和死亡演出保持逐帧；中远距实体按稳定身份分散到二分之一或
 * 四分之一更新频率，避免所有腿部曲线在同一帧集中计算。
 */
export class CurveCrawlerRenderCadence {
  public readonly updates: Uint8Array;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('Curve Crawler 渲染节奏容量必须是正整数。');
    }
    this.updates = new Uint8Array(capacity);
  }

  /** 为当前紧凑布局写入无更新、位置更新或带颜色更新三种命令。 */
  public schedule(
    renderIdentity: number,
    state: CurveCrawlerState,
    residents: CurveCrawlerResidentLayout,
    colors: CurveCrawlerColorSnapshot,
    frameSequence: number,
    poseDirty: boolean,
    force: boolean,
  ): void {
    if (!Number.isInteger(frameSequence) || frameSequence < 0) {
      throw new Error('Curve Crawler 渲染帧序号必须是非负整数。');
    }
    for (let packedIndex = 0; packedIndex < residents.count; packedIndex++) {
      const entityIndex = residents.entityIndices[packedIndex];
      const detail = residents.detailLevels[packedIndex] as PlanarVisibilityDetail;
      if (entityIndex === undefined || entityIndex >= state.count) {
        throw new Error('Curve Crawler 渲染节奏包含越界实体。');
      }
      if (force || colors.didEntityChange(entityIndex)) {
        this.updates[packedIndex] = CurveCrawlerPackedMeshUpdate.Shaded;
        continue;
      }
      if (!poseDirty) {
        this.updates[packedIndex] = CurveCrawlerPackedMeshUpdate.None;
        continue;
      }
      const lifecycle = state.data.vitality.state[entityIndex] as MonsterLifecycleState;
      this.updates[packedIndex] = lifecycle !== MonsterLifecycleState.Alive
        || isPoseFrameDue(renderIdentity, entityIndex, detail, frameSequence)
        ? CurveCrawlerPackedMeshUpdate.Position
        : CurveCrawlerPackedMeshUpdate.None;
    }
  }
}

function isPoseFrameDue(
  renderIdentity: number,
  entityIndex: number,
  detail: PlanarVisibilityDetail,
  frameSequence: number,
): boolean {
  if (detail === PlanarVisibilityDetail.Full) {
    return true;
  }
  const divisor = detail === PlanarVisibilityDetail.Reduced
    ? REDUCED_UPDATE_DIVISOR
    : MINIMAL_UPDATE_DIVISOR;
  return (frameSequence + entityIndex + renderIdentity * 3) % divisor === 0;
}
