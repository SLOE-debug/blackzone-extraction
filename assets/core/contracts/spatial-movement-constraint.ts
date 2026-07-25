import {
  type MutablePlanarPosition,
  type PlanarMovementConstraint,
} from './planar-movement-constraint';

/** 可由三维轨迹约束原地写入的世界空间位置。 */
export interface MutableSpatialPosition {
  x: number;
  y: number;
  z: number;
}

/** 同时支持地面移动与带高度轨迹采样的静态环境约束。 */
export interface SpatialMovementConstraint extends PlanarMovementConstraint {
  /**
   * 将一个三维轨迹采样点解析到环境允许的位置。
   *
   * @param startX 上一个轨迹采样点世界 X。
   * @param startY 上一个轨迹采样点世界 Y。
   * @param startZ 上一个轨迹采样点世界 Z。
   * @param targetX 当前候选采样点世界 X。
   * @param targetY 当前候选采样点世界 Y。
   * @param targetZ 当前候选采样点世界 Z。
   * @param radius 轨迹物体保守球形半径。
   * @param result 调用方复用的三维输出位置。
   */
  resolveSpatial(
    startX: number,
    startY: number,
    startZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    radius: number,
    result: MutableSpatialPosition,
  ): void;
}

/** 不施加地图约束的显式三维实现，供隔离测试使用。 */
export const UNCONSTRAINED_SPATIAL_MOVEMENT: SpatialMovementConstraint = Object.freeze({
  resolve(
    _startX: number,
    _startZ: number,
    targetX: number,
    targetZ: number,
    _radius: number,
    result: MutablePlanarPosition,
  ): void {
    result.x = targetX;
    result.z = targetZ;
  },
  resolveSpatial(
    _startX: number,
    _startY: number,
    _startZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    _radius: number,
    result: MutableSpatialPosition,
  ): void {
    result.x = targetX;
    result.y = targetY;
    result.z = targetZ;
  },
});
