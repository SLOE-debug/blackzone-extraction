const FIRE_ALIGNMENT_TOLERANCE_RADIANS = 8 / 180 * Math.PI;
const FIRE_MINIMUM_ALIGNMENT = Math.cos(FIRE_ALIGNMENT_TOLERANCE_RADIANS);

/** 仅在已经锁定目标且角色朝向与瞄准方向重合时批准射击。 */
export function shouldFireAtLockedTarget(
  targetLocked: boolean,
  facingX: number,
  facingZ: number,
  aimX: number,
  aimZ: number,
): boolean {
  return targetLocked
    && facingX * aimX + facingZ * aimZ >= FIRE_MINIMUM_ALIGNMENT;
}
