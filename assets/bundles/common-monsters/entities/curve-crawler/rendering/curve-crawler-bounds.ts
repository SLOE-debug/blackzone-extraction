import { type GeometryBounds } from '../../../../../core/geometry/buffer-geometry';
import {
  isMonsterLifecycleResident,
  MonsterLifecycleState,
} from '../../../../../core/contracts/monster-lifecycle';
import { CurveCrawlerDeathStage } from '../model/curve-crawler-life';
import { CURVE_CRAWLER_FRAGMENT_COUNT } from '../model/curve-crawler-schema';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

/** 可原地刷新的 Curve Crawler 群体包围盒。 */
export interface CurveCrawlerBounds extends GeometryBounds {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

/**
 * 创建并初始化可复用的群体渲染包围盒。
 */
export function createCurveCrawlerBounds(state: CurveCrawlerState): CurveCrawlerBounds {
  const bounds: CurveCrawlerBounds = {
    minX: 0,
    minY: 0,
    minZ: -1,
    maxX: 0,
    maxY: 0,
    maxZ: 1,
  };
  updateCurveCrawlerBounds(state, bounds);
  return bounds;
}

/**
 * 根据当前实体位置与形态半径原地刷新保守包围盒。
 */
export function updateCurveCrawlerBounds(
  state: CurveCrawlerState,
  bounds: CurveCrawlerBounds,
): void {
  const { transform, morphology, vitality, death, animation } = state.data;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < state.count; index++) {
    const lifecycleState = vitality.state[index] as MonsterLifecycleState;
    if (!isMonsterLifecycleResident(lifecycleState)) {
      continue;
    }
    const bodyLength = morphology.bodyLength[index] ?? 0;
    const liquidSpread = animation.liquidSpread[index] ?? 0;
    const liquidDrain = animation.liquidDrain[index] ?? 0;
    const baseReach = bodyLength * 0.5
      + (morphology.legLength[index] ?? 0) * 1.35
      + (morphology.legWidth[index] ?? 0);
    const liquidReach = (bodyLength * 0.8 + (morphology.legLength[index] ?? 0) * 0.48)
      * liquidSpread;
    const x = transform.x[index] ?? 0;
    const y = transform.y[index] ?? 0;
    const bodyWidth = morphology.bodyWidth[index] ?? 0;
    const legLength = morphology.legLength[index] ?? 0;
    const legWidth = morphology.legWidth[index] ?? 0;
    let minimumFragmentX = 0;
    let minimumFragmentY = 0;
    let maximumFragmentX = 0;
    let maximumFragmentY = 0;
    let maximumFragmentZ = 0;
    if (lifecycleState === MonsterLifecycleState.Dying
      && (death.stage[index] as CurveCrawlerDeathStage)
        === CurveCrawlerDeathStage.Bursting) {
      const fragmentOffset = index * CURVE_CRAWLER_FRAGMENT_COUNT;
      for (let fragment = 0; fragment < CURVE_CRAWLER_FRAGMENT_COUNT; fragment++) {
        const offset = fragmentOffset + fragment;
        minimumFragmentX = Math.min(minimumFragmentX, animation.fragmentOffsetX[offset] ?? 0);
        minimumFragmentY = Math.min(minimumFragmentY, animation.fragmentOffsetY[offset] ?? 0);
        maximumFragmentX = Math.max(maximumFragmentX, animation.fragmentOffsetX[offset] ?? 0);
        maximumFragmentY = Math.max(maximumFragmentY, animation.fragmentOffsetY[offset] ?? 0);
        maximumFragmentZ = Math.max(maximumFragmentZ, animation.fragmentOffsetZ[offset] ?? 0);
      }
    }
    minX = Math.min(minX, x - baseReach + minimumFragmentX, x - liquidReach);
    minY = Math.min(
      minY,
      y - baseReach + minimumFragmentY,
      y - liquidReach - liquidReach * liquidDrain * 1.35,
    );
    minZ = Math.min(minZ, -Math.max(bodyWidth * 0.15, legWidth));
    maxX = Math.max(maxX, x + baseReach + maximumFragmentX, x + liquidReach);
    maxY = Math.max(maxY, y + baseReach + maximumFragmentY, y + liquidReach);
    maxZ = Math.max(
      maxZ,
      bodyWidth * 0.3 + legLength * 0.76 + legWidth + maximumFragmentZ,
    );
  }

  if (minX === Number.POSITIVE_INFINITY) {
    minX = 0;
    minY = 0;
    minZ = -1;
    maxX = 0;
    maxY = 0;
    maxZ = 1;
  }

  bounds.minX = minX;
  bounds.minY = minY;
  bounds.minZ = minZ;
  bounds.maxX = maxX;
  bounds.maxY = maxY;
  bounds.maxZ = maxZ;
}
