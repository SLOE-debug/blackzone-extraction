import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在怪物空间索引完成后，用视觉锤头的连续轨迹收集本帧命中。 */
export class BattlefieldHammerSweepWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Combat;
  public readonly order = 0;
  protected readonly performanceStage = BattlefieldPerformanceStage.Weapon;

  protected execute(world: BattlefieldWorld): void {
    const { player, weapon } = world.resources;
    const owner = world.weaponOwnerState;
    owner.positionX = player.positionX;
    owner.positionY = player.positionY;
    owner.positionZ = player.positionZ;
    owner.heading = player.heading;
    owner.alive = player.isAlive;
    weapon.collectCombatHits(owner);
  }
}
