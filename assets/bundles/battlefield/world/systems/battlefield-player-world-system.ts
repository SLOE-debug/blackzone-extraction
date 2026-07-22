import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 推进玩家动画与移动。 */
export class BattlefieldPlayerWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.PreSimulation;
  public readonly order = 0;
  protected readonly performanceStage = BattlefieldPerformanceStage.Player;

  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    world.resources.player.update(deltaTime);
  }
}
