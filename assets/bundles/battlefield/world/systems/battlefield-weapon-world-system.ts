import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 同步玩家武器姿态、开火和弹体。 */
export class BattlefieldWeaponWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Combat;
  public readonly order = 0;
  protected readonly performanceStage = BattlefieldPerformanceStage.Weapon;

  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    const { player, weapon, monsters } = world.resources;
    const pose = world.weaponOwnerPose;
    player.writeWeaponRigPose(pose);
    pose.alive = player.isAlive;
    weapon.update(
      deltaTime,
      pose,
      world.weaponFiringRequested ? world.weaponAimTarget : null,
      monsters,
    );
  }
}
