const SEGMENT_EPSILON = 0.000001;

/**
 * 判断弦线是否与竖直胶囊重叠，并返回平面最近点在线段上的进度。
 *
 * 该查询不需要首次接触时间，因此只执行一次 XZ 投影与一次高度范围判断。
 */
export function findTetherVerticalCapsuleOverlapProgress(
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  centerX: number,
  centerY: number,
  centerZ: number,
  halfHeight: number,
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
  return lineY >= centerY - halfHeight && lineY <= centerY + halfHeight
    ? progress
    : -1;
}
