import { type UnlitColorBufferGeometry } from '../../../../../core/geometry/buffer-geometry';
import { type BattlefieldProjectileState } from '../model/battlefield-projectile-state';

/** 一发低密度分面弹体使用八个独立三角面。 */
export const BATTLEFIELD_PROJECTILE_TOPOLOGY = Object.freeze({
  verticesPerProjectile: 24,
  indicesPerProjectile: 24,
});

const LOCAL_TRIANGLES = new Float32Array([
  0, 0.012, 0.34, 0, 0.055, -0.06, 0.07, -0.005, -0.055,
  0, 0.012, 0.34, 0.07, -0.005, -0.055, -0.005, -0.045, -0.08,
  0, 0.012, 0.34, -0.005, -0.045, -0.08, -0.062, 0.004, -0.04,
  0, 0.012, 0.34, -0.062, 0.004, -0.04, 0, 0.055, -0.06,
  0.004, -0.008, -0.27, 0.07, -0.005, -0.055, 0, 0.055, -0.06,
  0.004, -0.008, -0.27, -0.005, -0.045, -0.08, 0.07, -0.005, -0.055,
  0.004, -0.008, -0.27, -0.062, 0.004, -0.04, -0.005, -0.045, -0.08,
  0.004, -0.008, -0.27, 0, 0.055, -0.06, -0.062, 0.004, -0.04,
]);

const PROJECTILE_PALETTE = Object.freeze([
  Object.freeze({ red: 1, green: 0.78, blue: 0.23, alpha: 0.96 }),
  Object.freeze({ red: 1, green: 0.48, blue: 0.08, alpha: 0.92 }),
  Object.freeze({ red: 1, green: 0.9, blue: 0.46, alpha: 0.98 }),
]);

const DIRECTION_EPSILON = 0.000001;

/** 初始化全部子弹槽位的固定索引和确定性分面颜色。 */
export function initializeBattlefieldProjectileGeometry(
  geometry: UnlitColorBufferGeometry,
  capacity: number,
): void {
  const topology = BATTLEFIELD_PROJECTILE_TOPOLOGY;
  const vertexCount = topology.verticesPerProjectile * capacity;
  const indexCount = topology.indicesPerProjectile * capacity;
  if (geometry.maxVertices !== vertexCount || geometry.maxIndices !== indexCount) {
    throw new Error('战场子弹几何容量与固定拓扑不一致。');
  }
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    geometry.index[vertex] = vertex;
    const localVertex = vertex % topology.verticesPerProjectile;
    const triangle = Math.floor(localVertex / 3);
    const color = PROJECTILE_PALETTE[triangle % PROJECTILE_PALETTE.length];
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

/** 把子弹 SoA 状态转换为批次世界空间顶点，停用槽位折叠为零面积。 */
export function writeBattlefieldProjectilePositions(
  state: BattlefieldProjectileState,
  positions: Float32Array,
): void {
  const verticesPerProjectile = BATTLEFIELD_PROJECTILE_TOPOLOGY.verticesPerProjectile;
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
    for (let component = 0; component < LOCAL_TRIANGLES.length; component += 3) {
      const localRight = LOCAL_TRIANGLES[component] ?? 0;
      const localY = LOCAL_TRIANGLES[component + 1] ?? 0;
      const localForward = LOCAL_TRIANGLES[component + 2] ?? 0;
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
