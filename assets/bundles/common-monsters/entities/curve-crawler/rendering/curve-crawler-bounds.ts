import { type GeometryBounds } from '../../../../../core/geometry/buffer-geometry';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

/**
 * 根据群体形态上限计算无需逐帧更新的保守渲染包围盒。
 */
export function computeCurveCrawlerBounds(state: CurveCrawlerState): GeometryBounds {
  const { morphology } = state.data;
  let maximumReach = 0;

  for (let index = 0; index < state.count; index++) {
    const reach = (morphology.bodyLength[index] ?? 0) * 0.5
      + (morphology.legLength[index] ?? 0) * 1.35
      + (morphology.legWidth[index] ?? 0);
    maximumReach = Math.max(maximumReach, reach);
  }

  return Object.freeze({
    minX: -state.arena.halfWidth - maximumReach,
    minY: -state.arena.halfHeight - maximumReach,
    minZ: -1,
    maxX: state.arena.halfWidth + maximumReach,
    maxY: state.arena.halfHeight + maximumReach,
    maxZ: 1,
  });
}
