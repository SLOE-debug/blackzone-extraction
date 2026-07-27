import { lerp } from '../../../core/math/scalar';
import { VanguardWeaponAction } from '../model/vanguard-weapon-action';

const EPSILON = 0.000001;

/** 把动作时间轴映射为主握点到锤头的连续局部方向。 */
export function writeVanguardTwoHandShaftDirection(
  result: Float64Array,
  action: VanguardWeaponAction,
  progress: number,
  recoverSide: -1 | 0 | 1,
  yawLag: number,
): void {
  const neutralX = 0;
  const neutralY = -0.96;
  const neutralZ = 0.28;
  switch (action) {
    case VanguardWeaponAction.WindupLeft:
      interpolateDirection(result, neutralX, neutralY, neutralZ, 0.84, -0.3, -0.45, progress);
      break;
    case VanguardWeaponAction.WindupRight:
      interpolateDirection(result, neutralX, neutralY, neutralZ, -0.84, -0.3, -0.45, progress);
      break;
    case VanguardWeaponAction.SwingLeft:
      interpolateDirection(result, 0.84, -0.3, -0.45, -0.86, -0.18, 0.48, progress);
      break;
    case VanguardWeaponAction.SwingRight:
      interpolateDirection(result, -0.84, -0.3, -0.45, 0.86, -0.18, 0.48, progress);
      break;
    case VanguardWeaponAction.Recover: {
      const side = recoverSide === 0 ? 1 : recoverSide;
      interpolateDirection(result, side * 0.86, -0.18, 0.48, neutralX, neutralY, neutralZ, progress);
      break;
    }
    case VanguardWeaponAction.Uppercut:
      if (progress < 0.55) {
        interpolateDirection(result, neutralX, neutralY, neutralZ, 0, 0.7, 0.72, progress / 0.55);
      } else {
        interpolateDirection(result, 0, 0.7, 0.72, neutralX, neutralY, neutralZ, (progress - 0.55) / 0.45);
      }
      break;
    case VanguardWeaponAction.GroundSlam:
      if (progress < 0.4) {
        interpolateDirection(result, neutralX, neutralY, neutralZ, 0, 0.72, -0.7, progress / 0.4);
      } else if (progress < 0.75) {
        interpolateDirection(result, 0, 0.72, -0.7, 0, -0.94, 0.35, (progress - 0.4) / 0.35);
      } else {
        interpolateDirection(result, 0, -0.94, 0.35, neutralX, neutralY, neutralZ, (progress - 0.75) / 0.25);
      }
      break;
    case VanguardWeaponAction.Spin:
      if (progress < 0.08) {
        interpolateDirection(result, neutralX, neutralY, neutralZ, 0.98, -0.16, 0, progress / 0.08);
      } else if (progress > 0.92) {
        interpolateDirection(result, 0.98, -0.16, 0, neutralX, neutralY, neutralZ, (progress - 0.92) / 0.08);
      } else {
        writeDirection(result, 0.98, -0.16, 0);
      }
      break;
    case VanguardWeaponAction.Idle:
      writeDirection(result, neutralX, neutralY, neutralZ);
      break;
  }
  const cosine = Math.cos(yawLag);
  const sine = Math.sin(yawLag);
  const x = result[0] ?? 0;
  const z = result[2] ?? 0;
  result[0] = x * cosine + z * sine;
  result[2] = -x * sine + z * cosine;
  const length = Math.max(Math.hypot(result[0] ?? 0, result[1] ?? -1, result[2] ?? 0), EPSILON);
  result[0] = (result[0] ?? 0) / length;
  result[1] = (result[1] ?? -1) / length;
  result[2] = (result[2] ?? 0) / length;
}

/** 返回动作期间主握点的局部目标坐标分量。 */
export function getVanguardTwoHandMainGripAxis(
  action: VanguardWeaponAction,
  progress: number,
  axis: 0 | 1 | 2,
): number {
  let x = 0.18;
  let y = 2.48;
  let z = 0.42;
  if (action === VanguardWeaponAction.GroundSlam) {
    y += Math.sin(progress * Math.PI) * 0.18;
    z += Math.sin(progress * Math.PI) * 0.12;
  } else if (action === VanguardWeaponAction.Uppercut) {
    y += Math.sin(progress * Math.PI) * 0.2;
    z += Math.sin(progress * Math.PI) * 0.16;
  } else if (action === VanguardWeaponAction.Spin) {
    x = 0.05;
    z = 0.48;
  }
  return axis === 0 ? x : axis === 1 ? y : z;
}

function interpolateDirection(
  result: Float64Array,
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  progress: number,
): void {
  const amount = progress * progress * (3 - progress * 2);
  writeDirection(
    result,
    lerp(startX, endX, amount),
    lerp(startY, endY, amount),
    lerp(startZ, endZ, amount),
  );
}

function writeDirection(result: Float64Array, x: number, y: number, z: number): void {
  result[0] = x;
  result[1] = y;
  result[2] = z;
}
