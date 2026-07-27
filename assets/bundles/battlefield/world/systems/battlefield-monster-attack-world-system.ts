import { WorldPhase } from '../../../../core/world/world-phase';
import {
  BattlefieldPerformanceEvent,
  BattlefieldPerformanceStage,
} from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';
import { calculateBattlefieldMonsterDamage } from '../../combat/battlefield-player-defense';

/** 在 Combat 尾部把怪物领域模拟产生的聚合攻击伤害回写玩家。 */
export class BattlefieldMonsterAttackWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Combat;
  public readonly order = 20;
  protected readonly performanceStage = BattlefieldPerformanceStage.Monsters;

  protected execute(world: BattlefieldWorld): void {
    const damage = world.pendingMonsterAttackDamage;
    world.pendingMonsterAttackDamage = 0;
    if (damage <= 0) {
      return;
    }
    const { player, performance, weapon } = world.resources;
    const defense = weapon.actionControl;
    if (defense.combatInvulnerable) {
      performance.recordEvent(BattlefieldPerformanceEvent.PlayerDamageBlocked, damage);
      return;
    }
    const appliedDamage = calculateBattlefieldMonsterDamage(damage, defense.damageTakenScale);
    if (appliedDamage <= 0) {
      return;
    }
    performance.recordEvent(BattlefieldPerformanceEvent.PlayerDamage, appliedDamage);
    player.damage(appliedDamage);
  }
}
