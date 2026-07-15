import { type GeometryBounds } from '../../../../../core/geometry/buffer-geometry';
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
  const { transform, morphology } = state.data;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < state.count; index++) {
    const reach = (morphology.bodyLength[index] ?? 0) * 0.5
      + (morphology.legLength[index] ?? 0) * 1.35
      + (morphology.legWidth[index] ?? 0);
    const x = transform.x[index] ?? 0;
    const y = transform.y[index] ?? 0;
    const bodyWidth = morphology.bodyWidth[index] ?? 0;
    const legLength = morphology.legLength[index] ?? 0;
    const legWidth = morphology.legWidth[index] ?? 0;
    minX = Math.min(minX, x - reach);
    minY = Math.min(minY, y - reach);
    minZ = Math.min(minZ, -Math.max(bodyWidth * 0.15, legWidth));
    maxX = Math.max(maxX, x + reach);
    maxY = Math.max(maxY, y + reach);
    maxZ = Math.max(maxZ, bodyWidth * 0.3 + legLength * 0.76 + legWidth);
  }

  bounds.minX = minX;
  bounds.minY = minY;
  bounds.minZ = minZ;
  bounds.maxX = maxX;
  bounds.maxY = maxY;
  bounds.maxZ = maxZ;
}
