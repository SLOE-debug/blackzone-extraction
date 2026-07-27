import { describe, expect, it } from 'vitest';
import { WeaponAction } from '../../assets/core/equipment/equipment';
import { getHammerActionControlProfile } from '../../assets/bundles/battlefield/equipment/combat/battlefield-hammer-action-control';
import { calculateBattlefieldMonsterDamage } from '../../assets/bundles/battlefield/combat/battlefield-player-defense';

describe('战场玩家动作防御', () => {
  it('旋风期间怪物聚合伤害缩放为零并由防御门面声明无敌', () => {
    const control = getHammerActionControlProfile(WeaponAction.Spin, 0.5);
    expect(control.combatInvulnerable).toBe(true);
    expect(calculateBattlefieldMonsterDamage(40, control.damageTakenScale)).toBe(0);
  });

  it('普通挥击不降低承受伤害', () => {
    const control = getHammerActionControlProfile(WeaponAction.SwingLeft, 0.5);
    expect(control.combatInvulnerable).toBe(false);
    expect(calculateBattlefieldMonsterDamage(40, control.damageTakenScale)).toBe(40);
  });
});
