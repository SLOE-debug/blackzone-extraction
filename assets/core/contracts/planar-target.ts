/** 二维平面射线走廊的有限线段查询。 */
export interface PlanarTargetQuery {
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
}

/** 由调用方复用的射线首次接触结果。 */
export interface MutablePlanarTargetResult {
  entityId: number;
  x: number;
  y: number;
  elevation: number;
  segmentProgress: number;
}

/** 能够在自身局部平面中解析射线首次接触目标的群体契约。 */
export interface PlanarTargetPopulation {
  /**
   * 查找有限线段最先经过的存活目标。
   *
   * @param query 局部平面中的有限线段。
   * @param result 调用方持有并复用的结果缓冲。
   * @returns 是否找到与线段实际相交的目标。
   */
  findFirstPlanarTarget(
    query: Readonly<PlanarTargetQuery>,
    result: MutablePlanarTargetResult,
  ): boolean;
}
