/** 完整圆周对应的弧度值。 */
export const TAU = Math.PI * 2;

/** 在两个数值之间进行线性插值。 */
export function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/** 按指数衰减速度将数值平滑逼近目标值。 */
export function damp(current: number, target: number, sharpness: number, deltaTime: number): number {
  return current + (target - current) * (1 - Math.exp(-sharpness * deltaTime));
}

/** 按最短旋转方向将角度平滑逼近目标角度。 */
export function dampAngle(current: number, target: number, sharpness: number, deltaTime: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * (1 - Math.exp(-sharpness * deltaTime));
}

/** 将角度约束到零至完整圆周之间。 */
export function wrapAngle(angle: number): number {
  const wrapped = angle % TAU;
  return wrapped < 0 ? wrapped + TAU : wrapped;
}
