/** Curve Crawler 群体局部分离使用的网格与位置约束参数。 */
export interface CurveCrawlerSeparationProfile {
  readonly cellSize: number;
  readonly bodyRadiusScale: number;
  readonly legRadiusScale: number;
  readonly legWidthRadiusScale: number;
  readonly minimumRadius: number;
  readonly solverIterations: number;
  readonly stiffness: number;
  readonly maximumCorrectionSpeed: number;
}

/**
 * 活体蜘蛛的默认占地模型。
 *
 * 半径覆盖完整身体和部分腿部展开范围，允许腿尖自然交错，但禁止身体压进同一位置。
 */
export const CURVE_CRAWLER_SEPARATION_PROFILE = Object.freeze({
  cellSize: 16,
  bodyRadiusScale: 0.42,
  legRadiusScale: 0.46,
  legWidthRadiusScale: 0.2,
  minimumRadius: 5,
  solverIterations: 3,
  stiffness: 0.88,
  maximumCorrectionSpeed: 52,
}) satisfies Readonly<CurveCrawlerSeparationProfile>;

/** 由个体形态计算平面占地圆半径。 */
export function calculateCurveCrawlerSeparationRadius(
  bodyWidth: number,
  legLength: number,
  legWidth: number,
  profile: Readonly<CurveCrawlerSeparationProfile> = CURVE_CRAWLER_SEPARATION_PROFILE,
): number {
  return Math.max(
    profile.minimumRadius,
    bodyWidth * profile.bodyRadiusScale
      + legLength * profile.legRadiusScale
      + legWidth * profile.legWidthRadiusScale,
  );
}
