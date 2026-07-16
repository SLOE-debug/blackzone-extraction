import { type MonsterObservationFootprint } from '../../../../../core/contracts/monster-observation';
import { type CurveCrawlerState } from './curve-crawler-state';

/**
 * 根据实际生成的形态计算观察场景使用的保守脚尖足迹。
 *
 * 足迹包含完整迈步幅度和蹲伏外展量，场景可据此在任意偏航角下保持玻璃间隙。
 */
export function createCurveCrawlerObservationFootprint(
  state: CurveCrawlerState,
): Readonly<MonsterObservationFootprint> {
  const { transform, morphology } = state.data;
  let forwardReach = 0;
  let lateralReach = 0;

  for (let index = 0; index < state.count; index++) {
    const bodyLength = morphology.bodyLength[index] ?? 0;
    const bodyWidth = morphology.bodyWidth[index] ?? 0;
    const legLength = morphology.legLength[index] ?? 0;
    const legWidth = morphology.legWidth[index] ?? 0;
    const footRadius = legWidth * 0.29 * 1.2;
    // 展示蜘蛛固定沿几何 -Y 朝前，因此局部 Y 偏移需要反号后计入前向足迹。
    const forwardOriginOffset = -(transform.y[index] ?? 0);
    const lateralOriginOffset = Math.abs(transform.x[index] ?? 0);

    forwardReach = Math.max(
      forwardReach,
      forwardOriginOffset + bodyLength * 0.42 + legLength * 0.96 + footRadius * 1.1,
      forwardOriginOffset + bodyLength * 0.58,
    );
    lateralReach = Math.max(
      lateralReach,
      lateralOriginOffset + bodyWidth * 0.4 + legLength * 0.78 * 1.12 + footRadius,
      lateralOriginOffset + bodyWidth * 0.52,
    );
  }

  return Object.freeze({ forwardReach, lateralReach });
}
