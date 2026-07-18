import {
  VANGUARD_MANTLE_PARTICLE_GRIDS,
  VANGUARD_MANTLE_REST_X,
  VANGUARD_MANTLE_REST_Y,
  VANGUARD_MANTLE_REST_Z,
} from '../model/vanguard-mantle-particles';

/** 固定距离约束的连续 TypedArray 配方。 */
export interface VanguardMantleConstraints {
  readonly particleA: Uint8Array;
  readonly particleB: Uint8Array;
  readonly restLength: Float32Array;
  readonly stiffness: Float32Array;
}

/** 自由披风共享的结构、剪切和弯曲约束。 */
export const VANGUARD_MANTLE_CONSTRAINTS = createConstraints();

function createConstraints(): VanguardMantleConstraints {
  const particleA: number[] = [];
  const particleB: number[] = [];
  const restLength: number[] = [];
  const stiffness: number[] = [];
  for (const panel of VANGUARD_MANTLE_PARTICLE_GRIDS) {
    for (let row = 0; row < panel.rows; row++) {
      for (let column = 0; column + 1 < panel.columns; column++) {
        addConstraint(panel.particleStart + row * panel.columns + column,
          panel.particleStart + row * panel.columns + column + 1,
          0.92, particleA, particleB, restLength, stiffness);
      }
    }
    for (let row = 0; row + 1 < panel.rows; row++) {
      for (let column = 0; column < panel.columns; column++) {
        addConstraint(panel.particleStart + row * panel.columns + column,
          panel.particleStart + (row + 1) * panel.columns + column,
          0.94, particleA, particleB, restLength, stiffness);
      }
    }
    for (let row = 0; row + 1 < panel.rows; row++) {
      for (let column = 0; column + 1 < panel.columns; column++) {
        const upperLeft = panel.particleStart + row * panel.columns + column;
        const upperRight = upperLeft + 1;
        const lowerLeft = panel.particleStart + (row + 1) * panel.columns + column;
        const lowerRight = lowerLeft + 1;
        addConstraint(upperLeft, lowerRight, 0.74,
          particleA, particleB, restLength, stiffness);
        addConstraint(upperRight, lowerLeft, 0.74,
          particleA, particleB, restLength, stiffness);
      }
    }
    for (let row = 0; row < panel.rows; row++) {
      for (let column = 0; column + 2 < panel.columns; column++) {
        addConstraint(panel.particleStart + row * panel.columns + column,
          panel.particleStart + row * panel.columns + column + 2,
          0.28, particleA, particleB, restLength, stiffness);
      }
    }
    for (let row = 0; row + 2 < panel.rows; row++) {
      for (let column = 0; column < panel.columns; column++) {
        addConstraint(panel.particleStart + row * panel.columns + column,
          panel.particleStart + (row + 2) * panel.columns + column,
          0.34, particleA, particleB, restLength, stiffness);
      }
    }
  }
  return Object.freeze({
    particleA: Uint8Array.from(particleA),
    particleB: Uint8Array.from(particleB),
    restLength: Float32Array.from(restLength),
    stiffness: Float32Array.from(stiffness),
  });
}

function addConstraint(
  a: number,
  b: number,
  strength: number,
  particleA: number[],
  particleB: number[],
  restLength: number[],
  stiffness: number[],
): void {
  const distance = Math.hypot(
    (VANGUARD_MANTLE_REST_X[b] ?? 0) - (VANGUARD_MANTLE_REST_X[a] ?? 0),
    (VANGUARD_MANTLE_REST_Y[b] ?? 0) - (VANGUARD_MANTLE_REST_Y[a] ?? 0),
    (VANGUARD_MANTLE_REST_Z[b] ?? 0) - (VANGUARD_MANTLE_REST_Z[a] ?? 0),
  );
  if (distance <= 0.000001) {
    throw new Error(`披风距离约束退化：${a}-${b}`);
  }
  particleA.push(a);
  particleB.push(b);
  restLength.push(distance);
  stiffness.push(strength);
}
