import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 消费攻击命令并推进大锤动作状态与近战查询。 */
export class BattlefieldWeaponWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.PreSimulation;
  public readonly order = 0;
  protected readonly performanceStage = BattlefieldPerformanceStage.Weapon;

  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    const { player, weapon } = world.resources;
    const owner = world.weaponOwnerState;
    owner.positionX = player.positionX;
    owner.positionY = player.positionY;
    owner.positionZ = player.positionZ;
    owner.heading = player.heading;
    owner.alive = player.isAlive;
    weapon.updateActions(deltaTime, owner);
  }
}
