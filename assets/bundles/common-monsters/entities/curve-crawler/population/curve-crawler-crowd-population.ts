import { type PlanarCrowdPopulation } from '../../../../../core/monsters/crowd/planar-crowd-population';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

/** 为 Curve Crawler SoA 构造战场共享 Crowd 视图。 */
export function createCurveCrawlerCrowdPopulation(
  state: CurveCrawlerState,
  populationId: number,
): PlanarCrowdPopulation {
  const radius = new Float32Array(state.count);
  const inverseMass = new Float32Array(state.count);
  const { morphology } = state.data;
  for (let index = 0; index < state.count; index++) {
    radius[index] = Math.max(
      5,
      (morphology.bodyWidth[index] ?? 0) * 0.42
        + (morphology.legLength[index] ?? 0) * 0.46
        + (morphology.legWidth[index] ?? 0) * 0.2,
    );
    inverseMass[index] = 1;
  }
  return Object.freeze({
    populationId,
    count: state.count,
    lifecycle: state.data.vitality.state,
    x: state.data.transform.x,
    y: state.data.transform.y,
    radius,
    inverseMass,
  });
}
