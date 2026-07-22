import { WorldPhase } from '../../../../core/world/world-phase';
import {
  BattlefieldPerformanceStage,
} from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在 Simulation 阶段推进怪物人口、行为、移动与动画状态。 */
export class BattlefieldMonsterWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Simulation;
  public readonly order = 0;
  protected readonly performanceStage = BattlefieldPerformanceStage.Monsters;

  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    const { player, monsters, performance } = world.resources;
    const target = world.monsterCombatTarget;
    target.x = player.positionX;
    target.z = player.positionZ;
    target.collisionRadius = player.collisionRadius;
    world.pendingMonsterAttackDamage = monsters.simulate(
      deltaTime,
      player.isAlive ? target : null,
      performance,
    );
  }
}
