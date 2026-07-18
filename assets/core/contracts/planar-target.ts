/** 二维平面目标查询的只读输入。 */
export interface PlanarTargetQuery {
  /** 查询射线起点的第一轴坐标。 */
  readonly originX: number;
  /** 查询射线起点的第二轴坐标。 */
  readonly originY: number;
  /** 已归一化查询方向的第一轴分量。 */
  readonly directionX: number;
  /** 已归一化查询方向的第二轴分量。 */
  readonly directionY: number;
  /** 允许吸附的最大直线距离。 */
  readonly maximumDistance: number;
  /** 目标方向与查询方向点积的最小值。 */
  readonly minimumAlignment: number;
}

/** 由调用方复用的二维目标查询结果，避免高频查询创建临时对象。 */
export interface MutablePlanarTargetResult {
  entityId: number;
  x: number;
  y: number;
}

/** 能够在自身局部二维平面中提供瞄准候选的群体契约。 */
export interface PlanarTargetPopulation {
  /**
   * 查找查询方向附近最适合辅助瞄准的存活目标。
   *
   * @param query 已归一化方向、距离和吸附角约束。
   * @param result 调用方持有并复用的结果缓冲。
   * @returns 是否找到符合约束的目标。
   */
  findBestPlanarTarget(
    query: Readonly<PlanarTargetQuery>,
    result: MutablePlanarTargetResult,
  ): boolean;
}
