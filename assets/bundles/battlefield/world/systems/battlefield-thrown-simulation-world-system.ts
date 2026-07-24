import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在怪物自主模拟后推进被投掷怪物的权威低弧线。 */
export class BattlefieldThrownSimulationWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Simulation;
  public readonly order = 20;
  protected readonly performanceStage = BattlefieldPerformanceStage.Player;

  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    world.resources.actions.simulateThrown(deltaTime);
  }
}
