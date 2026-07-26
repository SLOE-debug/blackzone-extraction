import {
  CombatTag,
  MonsterBodySize,
} from '../../../core/contracts/monster-manipulation';
import { type MutableBattlefieldManipulationCandidate } from './battlefield-monster-contracts';

const MAXIMUM_PLAYER_GRAB_RESISTANCE = 0.5;

/** 统一判断小型或中型怪是否满足玩家抓取协议。 */
export function isBattlefieldPlayerGrabbable(
  candidate: Readonly<MutableBattlefieldManipulationCandidate>,
): boolean {
  return candidate.playerGrabbable
    && (candidate.bodySize === MonsterBodySize.Small
      || candidate.bodySize === MonsterBodySize.Medium)
    && candidate.grabResistance <= MAXIMUM_PLAYER_GRAB_RESISTANCE
    && (candidate.tags & CombatTag.Elite) === 0
    && (candidate.tags & CombatTag.Executable) !== 0;
}
