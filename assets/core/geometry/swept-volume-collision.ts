const COLLISION_EPSILON = 0.000001;

/**
 * 求球体沿线段扫掠进入轴对齐盒扩张体的最早归一化时刻。
 *
 * 调用方应先把路径变换到 OBB 局部空间；盒体按球半径扩张，避免高速弹丸穿透。
 */
export function findSweptSphereBoxContact(
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  halfExtentX: number,
  halfExtentY: number,
  halfExtentZ: number,
  sphereRadius: number,
): number | null {
  const expandedX = halfExtentX + sphereRadius;
  const expandedY = halfExtentY + sphereRadius;
  const expandedZ = halfExtentZ + sphereRadius;
  let minimum = 0;
  let maximum = 1;
  const deltaX = endX - startX;
  if (Math.abs(deltaX) <= COLLISION_EPSILON) {
    if (Math.abs(startX) > expandedX) {
      return null;
    }
  } else {
    let near = (-expandedX - startX) / deltaX;
    let far = (expandedX - startX) / deltaX;
    if (near > far) {
      const swap = near;
      near = far;
      far = swap;
    }
    minimum = Math.max(minimum, near);
    maximum = Math.min(maximum, far);
    if (minimum > maximum) {
      return null;
    }
  }
  const deltaY = endY - startY;
  if (Math.abs(deltaY) <= COLLISION_EPSILON) {
    if (Math.abs(startY) > expandedY) {
      return null;
    }
  } else {
    let near = (-expandedY - startY) / deltaY;
    let far = (expandedY - startY) / deltaY;
    if (near > far) {
      const swap = near;
      near = far;
      far = swap;
    }
    minimum = Math.max(minimum, near);
    maximum = Math.min(maximum, far);
    if (minimum > maximum) {
      return null;
    }
  }
  const deltaZ = endZ - startZ;
  if (Math.abs(deltaZ) <= COLLISION_EPSILON) {
    return Math.abs(startZ) <= expandedZ ? minimum : null;
  }
  let near = (-expandedZ - startZ) / deltaZ;
  let far = (expandedZ - startZ) / deltaZ;
  if (near > far) {
    const swap = near;
    near = far;
    far = swap;
  }
  minimum = Math.max(minimum, near);
  maximum = Math.min(maximum, far);
  return minimum <= maximum ? minimum : null;
}

/** 求球体沿线段扫掠接触任意方向胶囊体的最早归一化时刻。 */
export function findSweptSphereCapsuleContact(
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  capsuleStartX: number,
  capsuleStartY: number,
  capsuleStartZ: number,
  capsuleEndX: number,
  capsuleEndY: number,
  capsuleEndZ: number,
  combinedRadius: number,
): number | null {
  const rayX = endX - startX;
  const rayY = endY - startY;
  const rayZ = endZ - startZ;
  const axisX = capsuleEndX - capsuleStartX;
  const axisY = capsuleEndY - capsuleStartY;
  const axisZ = capsuleEndZ - capsuleStartZ;
  const originX = startX - capsuleStartX;
  const originY = startY - capsuleStartY;
  const originZ = startZ - capsuleStartZ;
  const axisLengthSquared = dot(axisX, axisY, axisZ, axisX, axisY, axisZ);
  if (axisLengthSquared <= COLLISION_EPSILON) {
    return findSweptSpherePointContact(
      startX, startY, startZ, endX, endY, endZ,
      capsuleStartX, capsuleStartY, capsuleStartZ, combinedRadius,
    );
  }
  const startAxisProgress = Math.max(0, Math.min(
    dot(originX, originY, originZ, axisX, axisY, axisZ) / axisLengthSquared,
    1,
  ));
  const nearestStartX = capsuleStartX + axisX * startAxisProgress;
  const nearestStartY = capsuleStartY + axisY * startAxisProgress;
  const nearestStartZ = capsuleStartZ + axisZ * startAxisProgress;
  const startDistanceX = startX - nearestStartX;
  const startDistanceY = startY - nearestStartY;
  const startDistanceZ = startZ - nearestStartZ;
  if (dot(
    startDistanceX, startDistanceY, startDistanceZ,
    startDistanceX, startDistanceY, startDistanceZ,
  ) <= combinedRadius * combinedRadius) {
    return 0;
  }
  const axisRay = dot(axisX, axisY, axisZ, rayX, rayY, rayZ);
  const axisOrigin = dot(axisX, axisY, axisZ, originX, originY, originZ);
  const rayOrigin = dot(rayX, rayY, rayZ, originX, originY, originZ);
  const originLengthSquared = dot(originX, originY, originZ, originX, originY, originZ);
  const coefficientA = axisLengthSquared * dot(rayX, rayY, rayZ, rayX, rayY, rayZ)
    - axisRay * axisRay;
  const coefficientB = axisLengthSquared * rayOrigin - axisOrigin * axisRay;
  const coefficientC = axisLengthSquared * originLengthSquared
    - axisOrigin * axisOrigin
    - combinedRadius * combinedRadius * axisLengthSquared;
  let best = Number.POSITIVE_INFINITY;
  const discriminant = coefficientB * coefficientB - coefficientA * coefficientC;
  if (Math.abs(coefficientA) > COLLISION_EPSILON && discriminant >= 0) {
    const time = (-coefficientB - Math.sqrt(discriminant)) / coefficientA;
    const axisProgress = axisOrigin + time * axisRay;
    if (time >= 0 && time <= 1 && axisProgress >= 0 && axisProgress <= axisLengthSquared) {
      best = time;
    }
  }
  const startCap = findSweptSpherePointContact(
    startX, startY, startZ, endX, endY, endZ,
    capsuleStartX, capsuleStartY, capsuleStartZ, combinedRadius,
  );
  if (startCap !== null) {
    best = Math.min(best, startCap);
  }
  const endCap = findSweptSpherePointContact(
    startX, startY, startZ, endX, endY, endZ,
    capsuleEndX, capsuleEndY, capsuleEndZ, combinedRadius,
  );
  if (endCap !== null) {
    best = Math.min(best, endCap);
  }
  return best === Number.POSITIVE_INFINITY ? null : best;
}

function findSweptSpherePointContact(
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  pointX: number,
  pointY: number,
  pointZ: number,
  radius: number,
): number | null {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const deltaZ = endZ - startZ;
  const relativeX = startX - pointX;
  const relativeY = startY - pointY;
  const relativeZ = startZ - pointZ;
  const a = dot(deltaX, deltaY, deltaZ, deltaX, deltaY, deltaZ);
  const b = 2 * dot(relativeX, relativeY, relativeZ, deltaX, deltaY, deltaZ);
  const c = dot(relativeX, relativeY, relativeZ, relativeX, relativeY, relativeZ)
    - radius * radius;
  if (c <= 0) {
    return 0;
  }
  const discriminant = b * b - 4 * a * c;
  if (a <= COLLISION_EPSILON || discriminant < 0) {
    return null;
  }
  const time = (-b - Math.sqrt(discriminant)) / (2 * a);
  return time >= 0 && time <= 1 ? time : null;
}

function dot(
  firstX: number,
  firstY: number,
  firstZ: number,
  secondX: number,
  secondY: number,
  secondZ: number,
): number {
  return firstX * secondX + firstY * secondY + firstZ * secondZ;
}
