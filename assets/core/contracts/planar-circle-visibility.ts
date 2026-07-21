/** 在调用方约定的二维坐标系中判断一个保守圆是否可见。 */
export interface PlanarCircleVisibility {
  isCircleVisible(centerX: number, centerY: number, radius: number): boolean;
}
