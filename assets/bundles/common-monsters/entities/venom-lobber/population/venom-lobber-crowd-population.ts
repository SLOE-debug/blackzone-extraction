import { type PlanarCrowdPopulation } from '../../../../../core/monsters/crowd/planar-crowd-population';
import { type VenomLobberState } from '../model/venom-lobber-state';

const VENOM_LOBBER_INVERSE_MASS = 0.28;

/** 为重型 Venom Lobber SoA 构造战场共享 Crowd 视图。 */
export function createVenomLobberCrowdPopulation(
  state: VenomLobberState,
  populationId: number,
): PlanarCrowdPopulation {
  const radius = new Float32Array(state.count);
  const inverseMass = new Float32Array(state.count);
  for (let index = 0; index < state.count; index++) {
    radius[index] = 3.8 * (state.data.morphology.scale[index] ?? 1);
    inverseMass[index] = VENOM_LOBBER_INVERSE_MASS;
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
