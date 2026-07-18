/** 由调用方复用的世界 XZ 平面方向缓冲。 */
export interface MutableBattlefieldPlanarDirection {
  x: number;
  z: number;
}

/** 把屏幕方向按当前相机水平轨道角转换为世界 XZ 平面方向。 */
export function writeBattlefieldCameraRelativeDirection(
  azimuthAngle: number,
  screenX: number,
  screenY: number,
  result: MutableBattlefieldPlanarDirection,
): void {
  if (!Number.isFinite(azimuthAngle)
    || !Number.isFinite(screenX)
    || !Number.isFinite(screenY)) {
    throw new Error('战场相机方向参数必须是有限数值。');
  }
  const sine = Math.sin(azimuthAngle);
  const cosine = Math.cos(azimuthAngle);
  result.x = cosine * screenX - sine * screenY;
  result.z = -sine * screenX - cosine * screenY;
}
