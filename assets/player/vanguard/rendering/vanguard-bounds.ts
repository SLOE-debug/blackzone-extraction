import { type GeometryBounds } from '../../../core/geometry/buffer-geometry';
import { type VanguardState } from '../model/vanguard-state';

/** 由渲染器持有并逐帧复用的可写包围盒。 */
export interface MutableVanguardBounds {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

/** 根据主角站位创建覆盖宽檐帽、披肩、双臂、任意朝向和待机摆动的保守包围盒。 */
export function createVanguardBounds(state: VanguardState): GeometryBounds {
  const bounds = {
    minX: 0,
    minY: 0,
    minZ: 0,
    maxX: 0,
    maxY: 0,
    maxZ: 0,
  };
  writeVanguardBounds(state, bounds);
  return Object.freeze(bounds);
}

/** 将当前主角位置对应的保守包围盒写入调用方复用缓冲。 */
export function writeVanguardBounds(state: VanguardState, bounds: MutableVanguardBounds): void {
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
    maxY = Math.max(maxY, y + 4.2);
    maxZ = Math.max(maxZ, z + 1.7);
  }

  bounds.minX = minX;
  bounds.minY = minY;
  bounds.minZ = minZ;
  bounds.maxX = maxX;
  bounds.maxY = maxY;
  bounds.maxZ = maxZ;
}
