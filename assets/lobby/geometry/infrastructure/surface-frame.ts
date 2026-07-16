const UNIT_TOLERANCE = 0.0001;

/**
 * 描述参数化曲面的局部 U、V、N 坐标基。
 *
 * U、V 负责曲面切向定位，N 负责法向形变；三个方向必须是互相正交的单位向量，
 * 但允许 U×V 与 N 同向或反向，由具体 Patch 的绕序配置决定最终表面朝向。
 */
export interface SurfaceFrame {
  readonly originX: number;
  readonly originY: number;
  readonly originZ: number;
  readonly ux: number;
  readonly uy: number;
  readonly uz: number;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
}

/**
 * 校验并冻结曲面局部坐标基。
 *
 * @param frame 待校验的曲面原点与三个单位方向。
 * @returns 可安全复用的只读曲面坐标基。
 */
export function defineSurfaceFrame(frame: Readonly<SurfaceFrame>): Readonly<SurfaceFrame> {
  const components = [
    frame.originX,
    frame.originY,
    frame.originZ,
    frame.ux,
    frame.uy,
    frame.uz,
    frame.vx,
    frame.vy,
    frame.vz,
    frame.nx,
    frame.ny,
    frame.nz,
  ];
  if (components.some((value) => !Number.isFinite(value))) {
    throw new Error('曲面坐标基必须由有限数值组成。');
  }

  assertUnitVector(frame.ux, frame.uy, frame.uz, 'U');
  assertUnitVector(frame.vx, frame.vy, frame.vz, 'V');
  assertUnitVector(frame.nx, frame.ny, frame.nz, 'N');
  assertOrthogonal(frame.ux, frame.uy, frame.uz, frame.vx, frame.vy, frame.vz, 'U/V');
  assertOrthogonal(frame.ux, frame.uy, frame.uz, frame.nx, frame.ny, frame.nz, 'U/N');
  assertOrthogonal(frame.vx, frame.vy, frame.vz, frame.nx, frame.ny, frame.nz, 'V/N');
  return Object.freeze({ ...frame });
}

/** 验证向量为单位长度，保证 Patch 的宽高和法向位移不被坐标基暗中缩放。 */
function assertUnitVector(x: number, y: number, z: number, name: string): void {
  const length = Math.hypot(x, y, z);
  if (Math.abs(length - 1) > UNIT_TOLERANCE) {
    throw new Error(`曲面坐标基 ${name} 必须是单位向量。`);
  }
}

/** 验证两个坐标方向互相正交。 */
function assertOrthogonal(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  name: string,
): void {
  const dot = ax * bx + ay * by + az * bz;
  if (Math.abs(dot) > UNIT_TOLERANCE) {
    throw new Error(`曲面坐标基 ${name} 必须互相正交。`);
  }
}
