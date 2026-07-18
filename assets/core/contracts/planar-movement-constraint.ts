/** 可由移动系统原地写入的世界 XZ 平面位置。 */
export interface MutablePlanarPosition {
  x: number;
  z: number;
}

/**
 * 为可复用实体解析世界 XZ 平面中的候选位移。
 *
 * 实现方只负责平面障碍约束，不拥有输入、速度、朝向或角色动画。
 */
export interface PlanarMovementConstraint {
  /**
   * 将候选终点解析为允许角色占据的位置。
   *
   * @param startX 当前世界 X。
   * @param startZ 当前世界 Z。
   * @param targetX 候选世界 X。
   * @param targetZ 候选世界 Z。
   * @param radius 移动物体的平面占地半径。
   * @param result 调用方复用的输出位置。
   */
  resolve(
    startX: number,
    startZ: number,
    targetX: number,
    targetZ: number,
    radius: number,
    result: MutablePlanarPosition,
  ): void;
}

/** 不施加地图约束的显式移动实现，供展示场景和隔离测试使用。 */
export const UNCONSTRAINED_PLANAR_MOVEMENT: PlanarMovementConstraint = Object.freeze({
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
});
