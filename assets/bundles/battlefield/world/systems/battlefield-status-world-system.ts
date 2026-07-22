import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 刷新玩家状态 HUD，并在首次死亡时冻结交互。 */
export class BattlefieldStatusWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Presentation;
  public readonly order = 0;
  protected readonly performanceStage = BattlefieldPerformanceStage.Status;

  protected execute(world: BattlefieldWorld): void {
    const { player, weapon, controls } = world.resources;
    controls.presentPlayerHealth(player.health, player.maximumHealth);
    controls.presentWeaponAmmunition(weapon.ammunitionStatus);
    world.presentDefeatIfNeeded();
  }
}
