import { type VenomLobberData } from '../model/venom-lobber-schema';

/** 合并生命周期根高度与战场通用腾空高度。 */
export function readVenomLobberBodyRootElevation(
  data: VenomLobberData,
  entityIndex: number,
): number {
  return (data.animation.rootElevation[entityIndex] ?? 0)
    + (data.effects.externalElevation[entityIndex] ?? 0);
}
