import { type GeometryBounds } from '../../../core/geometry/buffer-geometry';
import { type VanguardState } from '../model/vanguard-state';

/** 根据主角站位创建覆盖碎发、围巾、双臂和侧置长剑的保守包围盒。 */
export function createVanguardBounds(state: VanguardState): GeometryBounds {
  const { transform } = state.data;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < state.count; index++) {
    const x = transform.x[index] ?? 0;
    const y = transform.y[index] ?? 0;
    const z = transform.z[index] ?? 0;
    minX = Math.min(minX, x - 1.7);
    minY = Math.min(minY, y - 0.03);
    minZ = Math.min(minZ, z - 1.7);
    maxX = Math.max(maxX, x + 1.7);
    maxY = Math.max(maxY, y + 4.12);
    maxZ = Math.max(maxZ, z + 1.7);
  }

  return Object.freeze({ minX, minY, minZ, maxX, maxY, maxZ });
}
