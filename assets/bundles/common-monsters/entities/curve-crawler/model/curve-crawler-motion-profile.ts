/** Curve Crawler 的高层运动与行为用途。 */
export enum CurveCrawlerMotionProfile {
  Autonomous = 'autonomous',
  ObservationDisplay = 'observation-display',
}

/** 自主游荡的默认速度响应锐度。 */
export const CURVE_CRAWLER_AUTONOMOUS_SPEED_SHARPNESS = 4.5;

/** 观察展示跟随场景真实速度时使用的响应锐度。 */
export const CURVE_CRAWLER_OBSERVATION_SPEED_SHARPNESS = 9;
