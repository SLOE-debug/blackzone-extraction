import { WorldPhase } from '../../../../core/world/world-phase';
import {
  BattlefieldPerformanceEvent,
  BattlefieldPerformanceStage,
} from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在武器伤害结算后推进怪物群体并回写玩家受击。 */
export class BattlefieldMonsterWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Combat;
  public readonly order = 10;
  protected readonly performanceStage = BattlefieldPerformanceStage.Monsters;

  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    const { player, monsters, performance } = world.resources;
    const target = world.monsterCombatTarget;
    target.x = player.positionX;
    target.z = player.positionZ;
    target.collisionRadius = player.collisionRadius;
    const attackDamage = monsters.update(
      deltaTime,
      player.isAlive ? target : null,
      performance,
    );
    if (attackDamage <= 0) {
      return;
    }
    performance.recordEvent(BattlefieldPerformanceEvent.PlayerDamage, attackDamage);
    player.damage(attackDamage);
  }
}
