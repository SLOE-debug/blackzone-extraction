import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在怪物自主模拟结束后统一结算本帧锤击伤害与受力效果。 */
export class BattlefieldCombatEventWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.PostSimulation;
  public readonly order = 10;
  protected readonly performanceStage = BattlefieldPerformanceStage.Monsters;

  protected execute(world: BattlefieldWorld): void {
    world.resources.weapon.resolveCombatEvents();
  }
}
