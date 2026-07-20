import { describe, expect, it } from 'vitest';
import { BATTLEFIELD_MONSTER_SPAWN } from '../../assets/bundles/battlefield/model/battlefield-monster-spawn';
import { calculateBattlefieldMonsterTargetCount } from '../../assets/bundles/battlefield/model/battlefield-monster-wave-schedule';

describe('battlefield monster wave schedule', () => {
  it('keeps the battlefield clear throughout the opening grace period', () => {
    expect(calculateBattlefieldMonsterTargetCount(BATTLEFIELD_MONSTER_SPAWN, 0)).toBe(0);
    expect(calculateBattlefieldMonsterTargetCount(
      BATTLEFIELD_MONSTER_SPAWN,
      BATTLEFIELD_MONSTER_SPAWN.openingGraceSeconds - 0.01,
    )).toBe(0);
  });

  it('starts with a small wave and adds reinforcements at fixed intervals', () => {
    const config = BATTLEFIELD_MONSTER_SPAWN;
    expect(calculateBattlefieldMonsterTargetCount(
      config,
      config.openingGraceSeconds,
    )).toBe(config.firstWaveCount);
    expect(calculateBattlefieldMonsterTargetCount(
      config,
      config.openingGraceSeconds + config.reinforcementIntervalSeconds,
    )).toBe(config.firstWaveCount + config.reinforcementCount);
  });

  it('never exceeds the configured population capacity', () => {
    expect(calculateBattlefieldMonsterTargetCount(
      BATTLEFIELD_MONSTER_SPAWN,
      60 * 60,
    )).toBe(BATTLEFIELD_MONSTER_SPAWN.populationCapacity);
  });
});
