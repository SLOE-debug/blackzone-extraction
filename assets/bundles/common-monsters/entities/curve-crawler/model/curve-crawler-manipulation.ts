import {
  CombatTag,
  MonsterBodySize,
} from '../../../../../core/contracts/monster-manipulation';

/** Curve Crawler 作为小型战斗操作对象时的固有能力。 */
export const CURVE_CRAWLER_MANIPULATION_PROFILE = Object.freeze({
  grabbable: true,
  executableHealthRatio: 0.5,
  bodySize: MonsterBodySize.Small,
  grabResistance: 0,
  playerGrabbable: true,
  baseTags: CombatTag.SmallBody,
  throwMass: 1.15,
  maximumThrowDistance: 108,
  collisionRadius: 5.2,
  impactStrength: 1.05,
});
