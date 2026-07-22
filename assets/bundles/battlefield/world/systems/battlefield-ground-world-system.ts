import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 把地面补丁中心同步到最新玩家位置。 */
export class BattlefieldGroundWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.SpatialIndex;
  public readonly order = 10;
  protected readonly performanceStage = BattlefieldPerformanceStage.WorldSynchronization;

  protected execute(world: BattlefieldWorld): void {
    const { player, ground } = world.resources;
    ground.updateCenter(player.positionX, player.positionZ);
  }
}
