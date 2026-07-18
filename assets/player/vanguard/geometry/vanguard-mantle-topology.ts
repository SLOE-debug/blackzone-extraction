/** 一块连续自由披风控制网格的固定布局。 */
export interface VanguardMantlePanelTopology {
  readonly particleStart: number;
  readonly rows: number;
  readonly columns: number;
  readonly triangleStart: number;
  readonly triangleCount: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly boundary: Uint8Array;
}

export const VANGUARD_MANTLE_HALF_THICKNESS = 0.027;

/** 正面三角形保持朝角色本地正 Z 的固定绕序。 */
export const VANGUARD_MANTLE_TRIANGLES = Uint8Array.from([
  0, 3, 4, 0, 4, 1,
  1, 4, 5, 1, 5, 2,
  3, 6, 7, 3, 7, 4,
  4, 7, 8, 4, 8, 5,
  9, 11, 12, 9, 12, 10,
]);

export const VANGUARD_MANTLE_PANELS = Object.freeze([
  Object.freeze({
    particleStart: 0,
    rows: 3,
    columns: 3,
    triangleStart: 0,
    triangleCount: 8,
    centerX: -0.65,
    centerY: 2.4,
    boundary: Uint8Array.from([0, 1, 2, 5, 8, 7, 6, 3]),
  }),
  Object.freeze({
    particleStart: 9,
    rows: 2,
    columns: 2,
    triangleStart: 8,
    triangleCount: 2,
    centerX: 0.48,
    centerY: 2.58,
    boundary: Uint8Array.from([9, 10, 12, 11]),
  }),
] satisfies readonly VanguardMantlePanelTopology[]);

/** 绑定形态的逐粒子中面法线。 */
export const VANGUARD_MANTLE_REST_NORMALS = createRestNormals();

function createRestNormals(): Readonly<{
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
}> {
  const x = new Float32Array(VANGUARD_MANTLE_PARTICLE_COUNT);
  const y = new Float32Array(VANGUARD_MANTLE_PARTICLE_COUNT);
  const z = new Float32Array(VANGUARD_MANTLE_PARTICLE_COUNT);
  for (let triangle = 0; triangle < VANGUARD_MANTLE_TRIANGLES.length; triangle += 3) {
    const a = VANGUARD_MANTLE_TRIANGLES[triangle] ?? 0;
    const b = VANGUARD_MANTLE_TRIANGLES[triangle + 1] ?? 0;
    const c = VANGUARD_MANTLE_TRIANGLES[triangle + 2] ?? 0;
    const abX = (VANGUARD_MANTLE_REST_X[b] ?? 0) - (VANGUARD_MANTLE_REST_X[a] ?? 0);
    const abY = (VANGUARD_MANTLE_REST_Y[b] ?? 0) - (VANGUARD_MANTLE_REST_Y[a] ?? 0);
    const abZ = (VANGUARD_MANTLE_REST_Z[b] ?? 0) - (VANGUARD_MANTLE_REST_Z[a] ?? 0);
    const acX = (VANGUARD_MANTLE_REST_X[c] ?? 0) - (VANGUARD_MANTLE_REST_X[a] ?? 0);
    const acY = (VANGUARD_MANTLE_REST_Y[c] ?? 0) - (VANGUARD_MANTLE_REST_Y[a] ?? 0);
    const acZ = (VANGUARD_MANTLE_REST_Z[c] ?? 0) - (VANGUARD_MANTLE_REST_Z[a] ?? 0);
    const normalX = abY * acZ - abZ * acY;
    const normalY = abZ * acX - abX * acZ;
    const normalZ = abX * acY - abY * acX;
    for (const particle of [a, b, c]) {
      x[particle] = (x[particle] ?? 0) + normalX;
      y[particle] = (y[particle] ?? 0) + normalY;
      z[particle] = (z[particle] ?? 0) + normalZ;
    }
  }
  for (let particle = 0; particle < VANGUARD_MANTLE_PARTICLE_COUNT; particle++) {
    const inverseLength = 1 / Math.max(
      Math.hypot(x[particle] ?? 0, y[particle] ?? 0, z[particle] ?? 0),
      0.000001,
    );
    const direction = (z[particle] ?? 0) < 0 ? -1 : 1;
    x[particle] = (x[particle] ?? 0) * inverseLength * direction;
    y[particle] = (y[particle] ?? 0) * inverseLength * direction;
    z[particle] = (z[particle] ?? 0) * inverseLength * direction;
  }
  return Object.freeze({ x, y, z });
}
import {
  VANGUARD_MANTLE_PARTICLE_COUNT,
  VANGUARD_MANTLE_REST_X,
  VANGUARD_MANTLE_REST_Y,
  VANGUARD_MANTLE_REST_Z,
} from '../model/vanguard-mantle-particles';
