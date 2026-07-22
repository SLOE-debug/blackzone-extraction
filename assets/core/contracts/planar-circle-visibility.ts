/** 可见实体依据观察中心距离使用的稳定几何细节档位。 */
export enum PlanarVisibilityDetail {
  Full,
  Reduced,
  Minimal,
}

/** 在调用方约定的二维坐标系中判断保守圆可见性并选择细节档位。 */
export interface PlanarCircleVisibility {
  isCircleVisible(centerX: number, centerY: number, radius: number): boolean;
  resolveDetail(
    centerX: number,
    centerY: number,
    current: PlanarVisibilityDetail,
  ): PlanarVisibilityDetail;
}
