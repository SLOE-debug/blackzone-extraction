import {
  VANGUARD_MANTLE_PARTICLE_COUNT,
  VANGUARD_MANTLE_REST_X,
  VANGUARD_MANTLE_REST_Y,
  VANGUARD_MANTLE_REST_Z,
} from './vanguard-mantle-particles';

/** 主角 SoA 中由披风系统和网格求值器共享的连续数据。 */
export interface MutableVanguardMantleData {
  readonly positionX: Float32Array;
  readonly positionY: Float32Array;
  readonly positionZ: Float32Array;
  readonly previousX: Float32Array;
  readonly previousY: Float32Array;
  readonly previousZ: Float32Array;
  readonly accumulator: Float32Array;
  readonly elapsedTime: Float32Array;
  readonly rootX: Float32Array;
  readonly rootY: Float32Array;
  readonly rootZ: Float32Array;
  readonly rootHeading: Float32Array;
  readonly rootScale: Float32Array;
  readonly initialized: Uint8Array;
}

/** 把单实体披风恢复到确定的绑定形态并清空全部历史速度。 */
export function writeVanguardMantleRestState(
  mantle: MutableVanguardMantleData,
  entityIndex: number,
  rootX: number,
  rootY: number,
  rootZ: number,
  rootHeading: number,
  rootScale: number,
): void {
  const particleOffset = entityIndex * VANGUARD_MANTLE_PARTICLE_COUNT;
  for (let particle = 0; particle < VANGUARD_MANTLE_PARTICLE_COUNT; particle++) {
    const target = particleOffset + particle;
    const x = VANGUARD_MANTLE_REST_X[particle] ?? 0;
    const y = VANGUARD_MANTLE_REST_Y[particle] ?? 0;
    const z = VANGUARD_MANTLE_REST_Z[particle] ?? 0;
    mantle.positionX[target] = x;
    mantle.positionY[target] = y;
    mantle.positionZ[target] = z;
    mantle.previousX[target] = x;
    mantle.previousY[target] = y;
    mantle.previousZ[target] = z;
  }
  mantle.accumulator[entityIndex] = 0;
  mantle.elapsedTime[entityIndex] = 0;
  mantle.rootX[entityIndex] = rootX;
  mantle.rootY[entityIndex] = rootY;
  mantle.rootZ[entityIndex] = rootZ;
  mantle.rootHeading[entityIndex] = rootHeading;
  mantle.rootScale[entityIndex] = rootScale;
}
