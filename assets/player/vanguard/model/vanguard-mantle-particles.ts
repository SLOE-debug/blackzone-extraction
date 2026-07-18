import { resolveVanguardDepth } from './vanguard-depth-profile';

/** 一块规则控制网格在全局披风粒子数组中的布局。 */
export interface VanguardMantleParticleGrid {
  readonly particleStart: number;
  readonly rows: number;
  readonly columns: number;
}

export const VANGUARD_MANTLE_PARTICLE_COUNT = 13;

/** 角色本地坐标中的自由披风中面绑定形态。 */
export const VANGUARD_MANTLE_REST_X = Float32Array.from([
  -0.62, -0.42, -0.23,
  -1.18, -0.78, -0.38,
  -1.1, -0.78, -0.49,
  0.31, 0.52,
  0.37, 0.72,
]);

export const VANGUARD_MANTLE_REST_Y = Float32Array.from([
  2.88, 2.82, 2.68,
  2.52, 2.45, 2.38,
  1.94, 1.88, 2.03,
  2.64, 2.88,
  2.39, 2.4,
]);

const VANGUARD_MANTLE_AUTHORED_REST_Z = Object.freeze([
  0.22, 0.28, 0.32,
  0.12, 0.2, 0.28,
  0.08, 0.14, 0.23,
  0.3, 0.21,
  0.24, 0.13,
]);

export const VANGUARD_MANTLE_REST_Z = Float32Array.from(
  VANGUARD_MANTLE_AUTHORED_REST_Z,
  (depth, particle) => resolveVanguardDepth(
    VANGUARD_MANTLE_REST_Y[particle] ?? 0,
    depth,
  ),
);

/** 顶边粒子固定到当前胸肩骨骼，其他粒子参与模拟。 */
export const VANGUARD_MANTLE_PINNED = Uint8Array.from([
  1, 1, 1,
  0, 0, 0,
  0, 0, 0,
  1, 1,
  0, 0,
]);

/** 不同位置的逆质量用于保留左长右短披片的重量差。 */
export const VANGUARD_MANTLE_INVERSE_MASS = Float32Array.from([
  0, 0, 0,
  1, 0.82, 0.68,
  1, 0.92, 0.78,
  0, 0,
  0.7, 1,
]);

/** 每个粒子允许向身体后方移动的最小本地 Z。 */
const VANGUARD_MANTLE_AUTHORED_BACKSTOP_Z = Object.freeze([
  0.22, 0.28, 0.32,
  -0.08, 0.04, 0.16,
  -0.16, -0.04, 0.13,
  0.3, 0.21,
  0.14, -0.07,
]);

export const VANGUARD_MANTLE_BACKSTOP_Z = Float32Array.from(
  VANGUARD_MANTLE_AUTHORED_BACKSTOP_Z,
  (depth, particle) => resolveVanguardDepth(
    VANGUARD_MANTLE_REST_Y[particle] ?? 0,
    depth,
  ),
);

export const VANGUARD_MANTLE_PARTICLE_GRIDS = Object.freeze([
  Object.freeze({ particleStart: 0, rows: 3, columns: 3 }),
  Object.freeze({ particleStart: 9, rows: 2, columns: 2 }),
] satisfies readonly VanguardMantleParticleGrid[]);
