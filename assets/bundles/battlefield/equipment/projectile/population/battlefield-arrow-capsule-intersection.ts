const INTERSECTION_REFINEMENT_STEPS = 12;
const SEGMENT_EPSILON = 0.0000001;

/**
 * 返回扫掠球首次接触竖直胶囊体时在线段上的进度，未接触时返回 -1。
 *
 * 先求线段与胶囊中轴的最近点，再在进入区间二分，避免把 XZ 投影命中误当成三维命中。
 */
export function findArrowVerticalCapsuleContactProgress(
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
  const axisStartY = centerY - halfHeight;
  const axisLength = halfHeight * 2;
  const relativeX = startX - centerX;
  const relativeY = startY - axisStartY;
  const relativeZ = startZ - centerZ;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY + segmentZ * segmentZ;
  const axisLengthSquared = axisLength * axisLength;
  const segmentAxisDot = segmentY * axisLength;
  const segmentRelativeDot = segmentX * relativeX
    + segmentY * relativeY
    + segmentZ * relativeZ;
  const axisRelativeDot = axisLength * relativeY;
  const denominator = segmentLengthSquared * axisLengthSquared
    - segmentAxisDot * segmentAxisDot;
  let closestProgress = denominator > SEGMENT_EPSILON
    ? (segmentAxisDot * axisRelativeDot - segmentRelativeDot * axisLengthSquared) / denominator
    : 0;
  closestProgress = clamp01(closestProgress);
  let axisProgress = axisLengthSquared > SEGMENT_EPSILON
    ? (segmentAxisDot * closestProgress + axisRelativeDot) / axisLengthSquared
    : 0;
  axisProgress = clamp01(axisProgress);
  if (segmentLengthSquared > SEGMENT_EPSILON) {
    closestProgress = clamp01((segmentAxisDot * axisProgress - segmentRelativeDot)
      / segmentLengthSquared);
  }
  if (distanceSquaredAtProgress(
    startX, startY, startZ, segmentX, segmentY, segmentZ,
    centerX, centerY, centerZ, halfHeight, closestProgress,
  ) > contactRadius * contactRadius) {
    return -1;
  }
  if (distanceSquaredAtProgress(
    startX, startY, startZ, segmentX, segmentY, segmentZ,
    centerX, centerY, centerZ, halfHeight, 0,
  ) <= contactRadius * contactRadius) {
    return 0;
  }
  let outside = 0;
  let inside = closestProgress;
  for (let step = 0; step < INTERSECTION_REFINEMENT_STEPS; step++) {
    const middle = (outside + inside) * 0.5;
    if (distanceSquaredAtProgress(
      startX, startY, startZ, segmentX, segmentY, segmentZ,
      centerX, centerY, centerZ, halfHeight, middle,
    ) <= contactRadius * contactRadius) {
      inside = middle;
    } else {
      outside = middle;
    }
  }
  return inside;
}

function distanceSquaredAtProgress(
  startX: number,
  startY: number,
  startZ: number,
  segmentX: number,
  segmentY: number,
  segmentZ: number,
  centerX: number,
  centerY: number,
  centerZ: number,
  halfHeight: number,
  progress: number,
): number {
  const x = startX + segmentX * progress;
  const y = startY + segmentY * progress;
  const z = startZ + segmentZ * progress;
  const nearestY = Math.max(centerY - halfHeight, Math.min(centerY + halfHeight, y));
  const deltaX = x - centerX;
  const deltaY = y - nearestY;
  const deltaZ = z - centerZ;
  return deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
