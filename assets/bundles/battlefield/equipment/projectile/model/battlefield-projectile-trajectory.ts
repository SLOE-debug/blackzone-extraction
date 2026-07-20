const TRAJECTORY_EPSILON = 0.000001;

/** 调用方复用的三维子弹方向。 */
export interface MutableBattlefieldProjectileDirection {
  x: number;
  y: number;
  z: number;
}

/** 写入从枪口位置精确指向锁定目标世界坐标的归一化三维方向。 */
export function writeBattlefieldProjectileDirection(
  originX: number,
  originY: number,
  originZ: number,
  targetX: number,
  targetY: number,
  targetZ: number,
  result: MutableBattlefieldProjectileDirection,
): void {
  if (!Number.isFinite(originX)
    || !Number.isFinite(originY)
    || !Number.isFinite(originZ)
    || !Number.isFinite(targetX)
    || !Number.isFinite(targetY)
    || !Number.isFinite(targetZ)) {
    throw new Error('战场子弹轨迹必须使用有限的枪口与目标坐标。');
  }
  const deltaX = targetX - originX;
  const deltaY = targetY - originY;
  const deltaZ = targetZ - originZ;
  const distance = Math.hypot(deltaX, deltaY, deltaZ);
  if (distance <= TRAJECTORY_EPSILON) {
    throw new Error('战场子弹枪口与目标坐标不能重合。');
  }
  const inverseDistance = 1 / distance;
  result.x = deltaX * inverseDistance;
  result.y = deltaY * inverseDistance;
  result.z = deltaZ * inverseDistance;
}
