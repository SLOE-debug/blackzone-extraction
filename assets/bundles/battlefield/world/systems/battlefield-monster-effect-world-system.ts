import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在怪物自主移动后叠加击退、腾空和磁化碰撞效果。 */
export class BattlefieldMonsterEffectWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Simulation;
  public readonly order = 10;
  protected readonly performanceStage = BattlefieldPerformanceStage.Monsters;

  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    world.resources.monsters.updateEffects(deltaTime);
  }
}
