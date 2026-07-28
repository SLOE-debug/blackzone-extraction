const SEGMENT_EPSILON = 0.000001;

/**
 * 判断弦线是否与目标的显式竖直范围重叠，并返回平面最近点在线段上的进度。
 *
 * 该查询只执行一次 XZ 投影与一次高度范围判断，不计算首次接触时间。
 */
export function findTetherVerticalRangeOverlapProgress(
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  centerX: number,
  centerZ: number,
  minimumY: number,
  maximumY: number,
  contactRadius: number,
): number {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const segmentZ = endZ - startZ;
  const planarLengthSquared = segmentX * segmentX + segmentZ * segmentZ;
  const progress = planarLengthSquared <= SEGMENT_EPSILON
    ? 0
    : Math.max(0, Math.min(1,
      ((centerX - startX) * segmentX + (centerZ - startZ) * segmentZ)
        / planarLengthSquared));
  const nearestX = startX + segmentX * progress;
  const nearestZ = startZ + segmentZ * progress;
  const deltaX = centerX - nearestX;
  const deltaZ = centerZ - nearestZ;
  if (deltaX * deltaX + deltaZ * deltaZ > contactRadius * contactRadius) {
    return -1;
  }
  const lineY = startY + segmentY * progress;
  return lineY >= minimumY && lineY <= maximumY ? progress : -1;
}
