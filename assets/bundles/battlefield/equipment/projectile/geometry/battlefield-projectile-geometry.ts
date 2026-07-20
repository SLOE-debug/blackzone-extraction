import { WeaponProjectileVisual } from '../../../../../core/equipment/equipment';
import { type UnlitColorBufferGeometry } from '../../../../../core/geometry/buffer-geometry';
import { type BattlefieldProjectileState } from '../model/battlefield-projectile-state';

/** 一发低密度分面弹体使用八个独立三角面。 */
export const BATTLEFIELD_PROJECTILE_TOPOLOGY = Object.freeze({
  verticesPerProjectile: 24,
  indicesPerProjectile: 24,
});

const BULLET_TRIANGLES = new Float32Array([
  0, 0.012, 0.34, 0, 0.055, -0.06, 0.07, -0.005, -0.055,
  0, 0.012, 0.34, 0.07, -0.005, -0.055, -0.005, -0.045, -0.08,
  0, 0.012, 0.34, -0.005, -0.045, -0.08, -0.062, 0.004, -0.04,
  0, 0.012, 0.34, -0.062, 0.004, -0.04, 0, 0.055, -0.06,
  0.004, -0.008, -0.27, 0.07, -0.005, -0.055, 0, 0.055, -0.06,
  0.004, -0.008, -0.27, -0.005, -0.045, -0.08, 0.07, -0.005, -0.055,
  0.004, -0.008, -0.27, -0.062, 0.004, -0.04, -0.005, -0.045, -0.08,
  0.004, -0.008, -0.27, 0, 0.055, -0.06, -0.062, 0.004, -0.04,
]);

const BUCKSHOT_PELLET_TRIANGLES = createScaledProjectileTriangles(
  BULLET_TRIANGLES,
  0.42,
  0.28,
);

const PROJECTILE_LOCAL_TRIANGLES = Object.freeze({
  [WeaponProjectileVisual.Bullet]: BULLET_TRIANGLES,
  [WeaponProjectileVisual.BuckshotPellet]: BUCKSHOT_PELLET_TRIANGLES,
} satisfies Readonly<Record<WeaponProjectileVisual, Float32Array>>);

const BULLET_PALETTE = Object.freeze([
  Object.freeze({ red: 1, green: 0.78, blue: 0.23, alpha: 0.96 }),
  Object.freeze({ red: 1, green: 0.48, blue: 0.08, alpha: 0.92 }),
  Object.freeze({ red: 1, green: 0.9, blue: 0.46, alpha: 0.98 }),
]);

const BUCKSHOT_PELLET_PALETTE = Object.freeze([
  Object.freeze({ red: 1, green: 0.88, blue: 0.48, alpha: 0.94 }),
  Object.freeze({ red: 1, green: 0.6, blue: 0.14, alpha: 0.9 }),
  Object.freeze({ red: 1, green: 0.96, blue: 0.7, alpha: 0.96 }),
]);

const PROJECTILE_PALETTES = Object.freeze({
  [WeaponProjectileVisual.Bullet]: BULLET_PALETTE,
  [WeaponProjectileVisual.BuckshotPellet]: BUCKSHOT_PELLET_PALETTE,
} satisfies Readonly<Record<WeaponProjectileVisual, readonly Readonly<ProjectileColor>[]>>);

interface ProjectileColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

const DIRECTION_EPSILON = 0.000001;

/** 初始化全部弹体槽位的固定索引和领域化分面颜色。 */
export function initializeBattlefieldProjectileGeometry(
  geometry: UnlitColorBufferGeometry,
  capacity: number,
  visual: WeaponProjectileVisual,
): void {
  const topology = BATTLEFIELD_PROJECTILE_TOPOLOGY;
  const vertexCount = topology.verticesPerProjectile * capacity;
  const indexCount = topology.indicesPerProjectile * capacity;
  if (geometry.maxVertices !== vertexCount || geometry.maxIndices !== indexCount) {
    throw new Error('战场子弹几何容量与固定拓扑不一致。');
  }
  const palette = PROJECTILE_PALETTES[visual];
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    geometry.index[vertex] = vertex;
    const localVertex = vertex % topology.verticesPerProjectile;
    const triangle = Math.floor(localVertex / 3);
    const color = palette[triangle % palette.length];
    if (color === undefined) {
      throw new Error('战场子弹分面颜色索引越界。');
    }
    const colorOffset = vertex * 4;
    geometry.colors[colorOffset] = color.red;
    geometry.colors[colorOffset + 1] = color.green;
    geometry.colors[colorOffset + 2] = color.blue;
    geometry.colors[colorOffset + 3] = color.alpha;
  }
  geometry.positions.fill(0);
  geometry.commitCounts(vertexCount, indexCount);
}

/** 把弹体 SoA 状态转换为批次世界空间顶点，停用槽位折叠为零面积。 */
export function writeBattlefieldProjectilePositions(
  state: BattlefieldProjectileState,
  positions: Float32Array,
  visual: WeaponProjectileVisual,
): void {
  const verticesPerProjectile = BATTLEFIELD_PROJECTILE_TOPOLOGY.verticesPerProjectile;
  const localTriangles = PROJECTILE_LOCAL_TRIANGLES[visual];
  for (let slot = 0; slot < state.capacity; slot++) {
    const targetStart = slot * verticesPerProjectile * 3;
    if ((state.active[slot] ?? 0) === 0) {
      positions.fill(0, targetStart, targetStart + verticesPerProjectile * 3);
      continue;
    }
    const originX = state.x[slot] ?? 0;
    const originY = state.y[slot] ?? 0;
    const originZ = state.z[slot] ?? 0;
    const forwardX = state.directionX[slot] ?? 0;
    const forwardY = state.directionY[slot] ?? 0;
    const forwardZ = state.directionZ[slot] ?? 1;
    const planarLength = Math.hypot(forwardX, forwardZ);
    const rightX = planarLength > DIRECTION_EPSILON ? forwardZ / planarLength : 1;
    const rightZ = planarLength > DIRECTION_EPSILON ? -forwardX / planarLength : 0;
    const upX = forwardY * rightZ;
    const upY = planarLength > DIRECTION_EPSILON ? planarLength : 0;
    const upZ = planarLength > DIRECTION_EPSILON
      ? -forwardY * rightX
      : -Math.sign(forwardY);
    for (let component = 0; component < localTriangles.length; component += 3) {
      const localRight = localTriangles[component] ?? 0;
      const localY = localTriangles[component + 1] ?? 0;
      const localForward = localTriangles[component + 2] ?? 0;
      const target = targetStart + component;
      positions[target] = originX
        + rightX * localRight
        + upX * localY
        + forwardX * localForward;
      positions[target + 1] = originY
        + upY * localY
        + forwardY * localForward;
      positions[target + 2] = originZ
        + rightZ * localRight
        + upZ * localY
        + forwardZ * localForward;
    }
  }
}

/** 从同一分面弹体拓扑派生短小霰弹曳光，保持固定顶点容量。 */
function createScaledProjectileTriangles(
  source: Float32Array,
  radialScale: number,
  forwardScale: number,
): Float32Array {
  const result = new Float32Array(source.length);
  for (let component = 0; component < source.length; component += 3) {
    result[component] = (source[component] ?? 0) * radialScale;
    result[component + 1] = (source[component + 1] ?? 0) * radialScale;
    result[component + 2] = (source[component + 2] ?? 0) * forwardScale;
  }
  return result;
}
