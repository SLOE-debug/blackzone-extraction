import { PlanarVisibilityDetail } from '../../../../../core/contracts/planar-circle-visibility';

/** 中距离保留每侧三条主要轮廓腿。 */
export const CURVE_CRAWLER_REDUCED_LEGS = Uint8Array.of(0, 1, 3, 4, 6, 7);

/** 远距离只保留四条交错轮廓腿，脚端由像素尺寸自然省略。 */
export const CURVE_CRAWLER_MINIMAL_LEGS = Uint8Array.of(0, 2, 4, 6);

/** 判断指定腿是否应在当前距离档位参与求值与索引提交。 */
export function isCurveCrawlerLegVisible(
  detail: PlanarVisibilityDetail,
  leg: number,
): boolean {
  if (detail === PlanarVisibilityDetail.Full) {
    return true;
  }
  return detail === PlanarVisibilityDetail.Reduced
    ? leg !== 2 && leg !== 5
    : (leg & 1) === 0;
}
