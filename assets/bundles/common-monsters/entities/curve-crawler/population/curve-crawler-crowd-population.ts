import { type PlanarCrowdPopulation } from '../../../../../core/monsters/crowd/planar-crowd-population';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

/** 为 Curve Crawler SoA 构造战场共享 Crowd 视图。 */
export function createCurveCrawlerCrowdPopulation(
  state: CurveCrawlerState,
  populationId: number,
): PlanarCrowdPopulation {
  const radius = new Float32Array(state.count);
  const centerHeight = new Float32Array(state.count);
  const halfHeight = new Float32Array(state.count);
  const inverseMass = new Float32Array(state.count);
  const participation = new Uint8Array(state.count);
  const { morphology } = state.data;
  for (let index = 0; index < state.count; index++) {
    radius[index] = Math.max(
      5,
      (morphology.bodyWidth[index] ?? 0) * 0.42
        + (morphology.legLength[index] ?? 0) * 0.46
        + (morphology.legWidth[index] ?? 0) * 0.2,
    );
    const bodyWidth = morphology.bodyWidth[index] ?? 0;
    centerHeight[index] = bodyWidth * 0.92;
    halfHeight[index] = bodyWidth * 0.42;
    inverseMass[index] = 1;
    participation[index] = 1;
  }
  return Object.freeze({
    populationId,
    count: state.count,
    lifecycle: state.data.vitality.state,
    participation,
    previousX: state.data.transform.previousX,
    previousY: state.data.transform.previousY,
    x: state.data.transform.x,
    y: state.data.transform.y,
    radius,
    centerHeight,
    halfHeight,
    elevation: state.data.effects.rootElevation,
    inverseMass,
  });
}
