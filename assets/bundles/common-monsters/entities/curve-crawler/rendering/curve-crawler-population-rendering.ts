import { type CurveCrawlerState } from '../model/curve-crawler-state';

/** 单个 Curve Crawler 群体向人口编排层暴露的最小渲染生命周期。 */
export interface CurveCrawlerPopulationRendering {
  /** 标记或立即提交当前群体的最新姿态。 */
  update(): void;
  /** 解除该群体占用的渲染资源或共享批次区段。 */
  dispose(): void;
}

/** 在群体状态完成创建后选择独占或共享渲染适配器。 */
export type CurveCrawlerPopulationRenderingFactory = (
  state: CurveCrawlerState,
) => CurveCrawlerPopulationRendering;
