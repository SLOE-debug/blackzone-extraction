import { describe, expect, it } from 'vitest';
import {
  CombatTag,
  MonsterBodySize,
} from '../../assets/core/contracts/monster-manipulation';
import { isBattlefieldPlayerGrabbable } from '../../assets/bundles/battlefield/population/battlefield-monster-grab-eligibility';
import { type MutableBattlefieldManipulationCandidate } from '../../assets/bundles/battlefield/population/battlefield-monster-contracts';

describe('战场怪物抓取资格', () => {
  it('允许低生命中型重物，但拒绝精英或高抗性目标', () => {
    const candidate = createMediumCandidate();
    expect(isBattlefieldPlayerGrabbable(candidate)).toBe(true);

    candidate.tags |= CombatTag.Elite;
    expect(isBattlefieldPlayerGrabbable(candidate)).toBe(false);
    candidate.tags &= ~CombatTag.Elite;
    candidate.grabResistance = 0.51;
    expect(isBattlefieldPlayerGrabbable(candidate)).toBe(false);
  });
});

function createMediumCandidate(): MutableBattlefieldManipulationCandidate {
  return {
    populationId: 3,
    entityId: 0,
    x: 0,
    y: 0.5,
    z: 2,
    healthRatio: 0.34,
    bodySize: MonsterBodySize.Medium,
    grabResistance: 0.45,
    playerGrabbable: true,
    tags: CombatTag.Armored | CombatTag.Executable,
    throwMass: 2.4,
    maximumThrowDistance: 10,
    collisionRadius: 0.64,
    impactStrength: 1.55,
  };
}
