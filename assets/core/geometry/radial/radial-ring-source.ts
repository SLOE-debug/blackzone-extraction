import { type RadialPositionArray } from './radial-workspace';

/** Feature 负责实现的 Radial Ring 与中心点采样契约。 */
export interface RadialRingSource<TContext> {
  /** 原地写入指定环和 Segment 的领域化三维位置。 */
  sampleRing(
    context: Readonly<TContext>,
    ringIndex: number,
    segmentIndex: number,
    output: RadialPositionArray,
    outputOffset: number,
  ): void;

  /** 原地写入指定 Fan 中心；没有中心点的 Plan 不会调用此方法。 */
  sampleCenter(
    context: Readonly<TContext>,
    centerIndex: number,
    output: RadialPositionArray,
    outputOffset: number,
  ): void;
}
