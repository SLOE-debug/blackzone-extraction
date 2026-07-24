import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 为后续 Reaction 模块保留独立的标准事件解析阶段。 */
export class BattlefieldCombatEventWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.PostSimulation;
  public readonly order = 10;
  protected readonly performanceStage = BattlefieldPerformanceStage.Monsters;

  protected execute(world: BattlefieldWorld): void {
    world.resources.actions.resolveEvents();
  }
}
