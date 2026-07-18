import { type BattlefieldEnvironmentColor } from './battlefield-environment-mesh-builder';

const BYTE_COLOR_SCALE = 1 / 255;

/** 由八位通道值创建冻结的线性顶点色近似值。 */
export function environmentColor(
  red: number,
  green: number,
  blue: number,
  alpha = 255,
): BattlefieldEnvironmentColor {
  return Object.freeze({
    red: red * BYTE_COLOR_SCALE,
    green: green * BYTE_COLOR_SCALE,
    blue: blue * BYTE_COLOR_SCALE,
    alpha: alpha * BYTE_COLOR_SCALE,
  });
}
