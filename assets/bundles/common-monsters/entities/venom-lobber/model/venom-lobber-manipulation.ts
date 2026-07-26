import {
  CombatTag,
  MonsterBodySize,
  MonsterManipulationState,
} from '../../../../../core/contracts/monster-manipulation';
import { type VenomLobberData } from './venom-lobber-schema';

/** Venom Lobber 作为中型重物时的抓取、投掷和撞击能力。 */
export const VENOM_LOBBER_MANIPULATION_PROFILE = Object.freeze({
  grabbable: true,
  executableHealthRatio: 0.35,
  bodySize: MonsterBodySize.Medium,
  grabResistance: 0.45,
  playerGrabbable: true,
  baseTags: CombatTag.Armored,
  throwMass: 2.4,
  maximumThrowDistance: 72,
  collisionRadius: 4.6,
  impactStrength: 1.55,
});

/** 为新建或复用槽位恢复相同的 Venom Lobber 操作能力。 */
export function initializeVenomLobberManipulation(
  manipulation: VenomLobberData['manipulation'],
  entityIndex: number,
): void {
  const profile = VENOM_LOBBER_MANIPULATION_PROFILE;
  manipulation.grabbable[entityIndex] = profile.grabbable ? 1 : 0;
  manipulation.executableHealthRatio[entityIndex] = profile.executableHealthRatio;
  manipulation.bodySize[entityIndex] = profile.bodySize;
  manipulation.grabResistance[entityIndex] = profile.grabResistance;
  manipulation.playerGrabbable[entityIndex] = profile.playerGrabbable ? 1 : 0;
  manipulation.tags[entityIndex] = profile.baseTags;
  manipulation.state[entityIndex] = MonsterManipulationState.Free;
  manipulation.throwMass[entityIndex] = profile.throwMass;
  manipulation.maximumThrowDistance[entityIndex] = profile.maximumThrowDistance;
  manipulation.collisionRadius[entityIndex] = profile.collisionRadius;
  manipulation.impactStrength[entityIndex] = profile.impactStrength;
  manipulation.elevation[entityIndex] = 0;
}
