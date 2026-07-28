const INTERSECTION_EPSILON = 0.0000001;

/**
 * 返回扫掠球首次接触竖直胶囊体时在线段上的进度，未接触时返回 -1。
 *
 * 分别解析求解中段竖直圆柱与上下端球的二次方程，并选择最早合法交点。
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
  const minimumAxisY = centerY - halfHeight;
  const maximumAxisY = centerY + halfHeight;
  if (distanceSquaredToVerticalCapsule(
    startX,
    startY,
    startZ,
    centerX,
    minimumAxisY,
    maximumAxisY,
    centerZ,
  ) <= contactRadius * contactRadius) {
    return 0;
  }

  let earliest = Number.POSITIVE_INFINITY;
  const relativeX = startX - centerX;
  const relativeZ = startZ - centerZ;
  const radialA = segmentX * segmentX + segmentZ * segmentZ;
  if (radialA > INTERSECTION_EPSILON) {
    const radialB = 2 * (relativeX * segmentX + relativeZ * segmentZ);
    const radialC = relativeX * relativeX + relativeZ * relativeZ
      - contactRadius * contactRadius;
    const discriminant = radialB * radialB - 4 * radialA * radialC;
    if (discriminant >= 0) {
      const cylinderProgress = (-radialB - Math.sqrt(discriminant)) / (2 * radialA);
      const contactY = startY + segmentY * cylinderProgress;
      if (cylinderProgress >= 0 && cylinderProgress <= 1
        && contactY >= minimumAxisY && contactY <= maximumAxisY) {
        earliest = cylinderProgress;
      }
    }
  }

  earliest = minimumPositive(
    earliest,
    findSegmentSphereEntryProgress(
      startX, startY, startZ,
      segmentX, segmentY, segmentZ,
      centerX, minimumAxisY, centerZ,
      contactRadius,
    ),
  );
  earliest = minimumPositive(
    earliest,
    findSegmentSphereEntryProgress(
      startX, startY, startZ,
      segmentX, segmentY, segmentZ,
      centerX, maximumAxisY, centerZ,
      contactRadius,
    ),
  );
  return Number.isFinite(earliest) ? earliest : -1;
}

/** 求有限线段进入球体的最早进度。 */
function findSegmentSphereEntryProgress(
  startX: number,
  startY: number,
  startZ: number,
  segmentX: number,
  segmentY: number,
  segmentZ: number,
  sphereX: number,
  sphereY: number,
  sphereZ: number,
  radius: number,
): number {
  const relativeX = startX - sphereX;
  const relativeY = startY - sphereY;
  const relativeZ = startZ - sphereZ;
  const a = segmentX * segmentX + segmentY * segmentY + segmentZ * segmentZ;
  if (a <= INTERSECTION_EPSILON) {
    return -1;
  }
  const b = 2 * (
    relativeX * segmentX + relativeY * segmentY + relativeZ * segmentZ
  );
  const c = relativeX * relativeX + relativeY * relativeY + relativeZ * relativeZ
    - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return -1;
  }
  const progress = (-b - Math.sqrt(discriminant)) / (2 * a);
  return progress >= 0 && progress <= 1 ? progress : -1;
}

function distanceSquaredToVerticalCapsule(
  x: number,
  y: number,
  z: number,
  centerX: number,
  minimumAxisY: number,
  maximumAxisY: number,
  centerZ: number,
): number {
  const nearestY = Math.max(minimumAxisY, Math.min(maximumAxisY, y));
  const deltaX = x - centerX;
  const deltaY = y - nearestY;
  const deltaZ = z - centerZ;
  return deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
}

function minimumPositive(current: number, candidate: number): number {
  return candidate >= 0 ? Math.min(current, candidate) : current;
}
